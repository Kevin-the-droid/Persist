"""LLM Tools for interacting with journal blocks and other agent capabilities

These tools are provided to the main LLM via function calling.
The LLM can create, read, update, and delete journal blocks to maintain its memory.
"""

import json
import re
from typing import Dict, List, Any, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import text
from cachetools import TTLCache

from backend.db.models.journal_block import JournalBlock
from backend.services.embedding_service import get_embedding_service
from backend.services.memory_service import search_memories as search_memories_service, fetch_full_memories
from backend.services.code_tools import (
    CODE_TOOLS,
    edit_file, read_file, write_file, list_directory,
    search_files, search_content, run_shell,
)
from backend.services.plugin_loader import load_plugins, PLUGINS_DIR
from backend.services.skill_loader import load_skills, SKILLS_DIR

# ============================================================================
# Web Tools Cache (30 minute TTL)
# ============================================================================
_web_cache = TTLCache(maxsize=100, ttl=1800)  # 100 items, 30 min TTL


# ============================================================================
# Tool Definitions (OpenAI Function Calling Format)
# ============================================================================

# Map of all available tools by name
ALL_TOOLS = {}  # Will be populated below

JOURNAL_BLOCK_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "list_journal_blocks",
            "description": (
                "List all of your journal blocks — your named, persistent memory slots. "
                "Each block has a label (topic) and an ID. "
                "Use this first to discover what blocks exist and get their IDs before reading, updating, or deleting. "
                "Returns: [{id, label, always_in_context, updated_at}]. "
                "always_in_context=true means the block is 'pinned' and always included in system prompt."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_journal_block",
            "description": (
                "Read the full content of one of your journal blocks by its ID. "
                "Call list_journal_blocks first to get the ID you need. "
                "Returns the label and full stored text."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "The UUID of the journal block to read (the 'id' field from list_journal_blocks)"
                    }
                },
                "required": ["id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_journal_block",
            "description": (
                "Create a new journal block to persistently remember something. "
                "Journal blocks are your long-term memory — they persist across all conversations. "
                "Use them to track anything worth remembering: facts about the user, ongoing projects, "
                "preferences, notes, plans, or reflections. "
                "Each block has a short label (its topic/title) and a value (the content to store). "
                "Returns the new block's ID on success."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "label": {
                        "type": "string",
                        "description": "Short topic name for this block, e.g. 'Kim — preferences', 'Project: Persist', 'My goals'"
                    },
                    "value": {
                        "type": "string",
                        "description": "The content to store in this block"
                    }
                },
                "required": ["label", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_journal_block",
            "description": (
                "Update the label, content, context pinning, or all of an existing journal block. "
                "Call list_journal_blocks first to find the block's ID. "
                "Only the fields you provide are changed; omit fields you want to leave as-is. "
                "Set always_in_context=true to 'pin' a block so it's always in your system prompt."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "The UUID of the block to update (the 'id' field from list_journal_blocks)"
                    },
                    "label": {
                        "type": "string",
                        "description": "New label/title for the block (omit to keep existing)"
                    },
                    "value": {
                        "type": "string",
                        "description": "New full content for the block (omit to keep existing)"
                    },
                    "always_in_context": {
                        "type": "boolean",
                        "description": "Set to true to pin this block to your system prompt, false to unpin (omit to keep existing)"
                    }
                },
                "required": ["id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_journal_block",
            "description": (
                "Permanently delete one of your journal blocks. "
                "Call list_journal_blocks first to find the block's ID. "
                "Use this when information is no longer relevant and you want to keep your memory clean."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "The UUID of the block to delete (the 'id' field from list_journal_blocks)"
                    }
                },
                "required": ["id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_memories",
            "description": (
                "Semantically search across all your memories — journal blocks, uploaded documents, "
                "and past conversation messages — using vector similarity. "
                "Returns a ranked list of matching memory snippets with their IDs and similarity scores. "
                "Use this when you want to find something you might remember but don't know which block it's in. "
                "To get the full content of a result, pass its ID to fetch_memories."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "What you're trying to recall or find"
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max results to return (default: 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_memories",
            "description": (
                "Fetch the full content of specific memories by their IDs. "
                "Use this after search_memories to retrieve complete details for results you want to read in full. "
                "Can fetch multiple memories in one call."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "memory_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of memory IDs to fetch (from search_memories results)"
                    }
                },
                "required": ["memory_ids"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_context_stats",
            "description": (
                "Get statistics about your current context window usage. "
                "Shows your agent's max context tokens, how many journal blocks are pinned (always_in_context), "
                "and how many are in RAG (not pinned). Use this to understand your memory situation."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_rag_files",
            "description": (
                "List all documents and files that have been uploaded to your RAG (retrieval-augmented generation) store. "
                "These are reference materials — PDFs, notes, docs — that have been chunked and indexed for semantic search. "
                "Returns folder names, file names, and chunk counts."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": (
                "Search the web via DuckDuckGo and return titles, URLs, and snippets for the top results. "
                "Use this to find current information, look up facts, research topics, or discover URLs "
                "you can then fetch with fetch_url for full content."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Number of results to return (default: 5, max: 10)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_url",
            "description": (
                "Fetch a web page and extract its main content as markdown. "
                "Use this to read the full text of a specific URL — documentation, articles, GitHub pages, etc. "
                "Content is truncated at 50,000 characters for very long pages."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The full URL to fetch"
                    },
                    "include_links": {
                        "type": "boolean",
                        "description": "Whether to include hyperlinks found in the content (default: false)",
                        "default": False
                    }
                },
                "required": ["url"]
            }
        }
    }
]

# ---------------------------------------------------------------------------
# Plugin system — Kevin's self-authored tools
# ---------------------------------------------------------------------------

# Mutable module-level state so reload_plugins() can update in-place
PLUGIN_TOOLS: List[Dict[str, Any]] = []
_plugin_executors: Dict[str, Any] = {}

def _init_plugins() -> None:
    """Load all plugins into the module-level registries."""
    defs, executors = load_plugins()
    PLUGIN_TOOLS.clear()
    PLUGIN_TOOLS.extend(defs)
    _plugin_executors.clear()
    _plugin_executors.update(executors)
    # Keep ALL_TOOLS in sync — remove stale plugin entries then re-add
    for key in [k for k, v in ALL_TOOLS.items() if k not in _CORE_TOOL_NAMES]:
        del ALL_TOOLS[key]
    for tool in PLUGIN_TOOLS:
        ALL_TOOLS[tool["function"]["name"]] = tool

_CORE_TOOL_NAMES: set = set()  # populated after ALL_TOOLS is built below

# Built-in tools that let Kevin hot-reload plugins and skills without a server restart
PLUGIN_MANAGEMENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "reload_plugins",
            "description": (
                "Re-scan the backend/services/plugins/ directory and load any new or updated plugins. "
                "Call this immediately after writing a new plugin file to make the new tool available "
                "in the current session — no server restart needed. "
                "Returns a list of all currently loaded plugin tools."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "reload_skills",
            "description": (
                "Re-scan backend/services/plugins/skills/ and return a summary of all loaded skill docs. "
                "Call this after writing a new SKILL.md to confirm it parsed correctly. "
                "The new skill will appear in your context on your next conversation turn. "
                "Returns a list of skill names, descriptions, and file paths."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
]

TODO_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "todo_write",
            "description": (
                "Replace your todo list with the provided one. "
                "Use this as a working-memory scratchpad for multi-step tasks. "
                "You always rewrite the WHOLE list — the array you pass becomes the new state, "
                "so include unchanged items too or they will be lost. "
                "The active list is shown back to you at the top of every user message so you can see current state. "
                "Status workflow: pending → in_progress → completed (or cancelled if abandoned). "
                "Keep exactly ONE todo in 'in_progress' at a time. "
                "Mark in_progress BEFORE starting work on it; mark completed IMMEDIATELY after finishing. "
                "Don't mark completed if blocked, partial, or errored — keep it in_progress and surface the blocker."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "todos": {
                        "type": "array",
                        "description": "The full new list. Each item replaces the previous list — items not included are deleted.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "Imperative-form description, e.g. 'Fix the embedding loader'"
                                },
                                "active_form": {
                                    "type": "string",
                                    "description": "Present-continuous form for the status line, e.g. 'Fixing the embedding loader'. Optional but recommended."
                                },
                                "status": {
                                    "type": "string",
                                    "enum": ["pending", "in_progress", "completed", "cancelled"],
                                    "description": "Current status. Default: pending."
                                }
                            },
                            "required": ["content"]
                        }
                    }
                },
                "required": ["todos"]
            }
        }
    },
]

# Populate ALL_TOOLS map for easy lookup
for tool in JOURNAL_BLOCK_TOOLS + CODE_TOOLS + TODO_TOOLS + PLUGIN_MANAGEMENT_TOOLS:
    tool_name = tool["function"]["name"]
    ALL_TOOLS[tool_name] = tool

# Lock in the set of core tool names (anything loaded before plugins)
_CORE_TOOL_NAMES = set(ALL_TOOLS.keys())

# Initial plugin load
_init_plugins()


# ============================================================================
# Tool Filtering
# ============================================================================

def get_enabled_tools(enabled_tool_names: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Get list of tools filtered by enabled tool names

    Args:
        enabled_tool_names: List of tool names to enable. If None or empty, returns all tools.

    Returns:
        List of tool definitions in OpenAI function calling format
    """
    if not enabled_tool_names:
        # No filter - return all tools
        return list(ALL_TOOLS.values())

    # Filter tools by name
    filtered_tools = []
    for tool_name in enabled_tool_names:
        if tool_name in ALL_TOOLS:
            filtered_tools.append(ALL_TOOLS[tool_name])

    return filtered_tools


_TOOL_USE_PREAMBLE = """=== Tool Use ===

You have real tools available — listed below under "Available Tools". When you
need to do something a tool covers (read a file, search memory, edit code, run
a shell command), CALL THE TOOL. Do not narrate doing it. Do not say "let me
check..." and then never check. The user can't see your intentions; they only
see the tool calls you actually emit and the text you write.

If you find yourself writing "I would now call read_file on X" — stop. Emit the
call instead. If you find yourself describing the contents of a file you
haven't read, stop and read it.

## How to invoke a tool

Tool calls are emitted as XML inside your response. The syntax is:

<minimax:tool_call>
<invoke name="tool_name">
<parameter name="param1">value1</parameter>
<parameter name="param2">value2</parameter>
</invoke>
</minimax:tool_call>

Example — reading a file:

<minimax:tool_call>
<invoke name="read_file">
<parameter name="path">backend/main.py</parameter>
</invoke>
</minimax:tool_call>

After you emit the call, stop generating. The system will execute the tool and
send the result back to you as a `tool` role message. Read the result, then
either call another tool or write your response to the user.

## Rules

- **Never invent tools.** Only call tools listed under "Available Tools". Calls
  to unknown tools fail.
- **Batch independent calls.** If two tool calls don't depend on each other
  (e.g. reading two different files, listing memory and searching files),
  emit BOTH in the same response — they run in parallel. Don't serialize work
  that can run concurrently.
- **One step at a time when dependent.** If call B needs the output of call A,
  emit only A, wait for the result, then emit B.
- **Surface errors honestly.** If a tool call returns an error, tell the user
  what failed instead of pretending it worked.
- **Confirm destructive ops.** For `rm -rf`, dropping tables, deleting journal
  blocks, force-pushing, etc. — confirm with the user first unless they've
  already told you to proceed.
- **Read before writing.** Don't edit a file you haven't read in this turn.
  Don't overwrite a journal block without checking what's there.

## NEVER confabulate

NEVER describe file contents, directory listings, command output, or code from
memory. If you haven't called a tool to read/list/run it IN THIS CONVERSATION,
you do not know what it contains. Period.

Wrong: "The directory contains main.py, utils.py, and config.py"
Right: call list_directory, then report what the tool returned.

Wrong: "The file imports asyncio and defines a class called Worker"
Right: call read_file, then describe what you actually see.

If you catch yourself about to state facts about file contents or directory
structure without having a tool result in front of you — STOP. Call the tool.
The user would rather wait 2 seconds for a real answer than get a plausible
guess that wastes 20 minutes.

## Error recovery

When a tool returns an error, do NOT:
- Pretend it succeeded and make up results
- Abandon the task without trying an alternative
- Repeat the exact same call

Instead:
- If "file not found" → call list_directory on the parent to find the right name
- If "permission denied" → tell the user, don't retry
- If a path doesn't exist → check your spelling, try search_files to locate it
- If a command fails → read the error message, adjust, and retry

## Complete the sequence — don't narrate the rest

A common failure mode: you call 1-2 tools successfully, then instead of
continuing to emit tool calls for the remaining steps, you NARRATE them:
"Now I'll update the block..." / "Let me add today's entry..." / "Done,
all three blocks updated." — without ever emitting the XML.

The user CANNOT see your narration as action. Only `<minimax:tool_call>` XML
actually executes. Describing a tool call in English is the same as not doing
it at all. The result in the database will be unchanged.

If your plan has 5 steps requiring tool calls, you must emit 5 tool calls
across however many turns that takes. There are no shortcuts. After each tool
result comes back, emit the NEXT `<minimax:tool_call>` — don't summarize what
you "would" do.

**Self-check before writing any sentence that starts with "Let me", "Now I'll",
"I need to", "I'll update", or "Good, all done":** Did you actually emit the
tool call XML for every step? If not, emit it now. The user is patient. The
system will run each call. You just have to produce the XML.

## Verify before concluding

Before telling the user "done" or "here's what I found":
- Did you actually read the file, or are you remembering it from a prior turn?
- Did the tool call succeed, or did it return an error you glossed over?
- Does the directory listing you're citing come from a tool result, or from your imagination?

If you aren't sure, call the tool again. It's cheap. Being wrong is expensive.

## Using your todo list

You have a per-agent todo list (`todo_write` tool). It's a working-memory
scratchpad for multi-step work — not a permanent log. The current list is
shown to you at the top of every user message under "=== Your Todo List ===",
so you always know where you are.

**Use it when:**
- A task has 3+ distinct steps you want to track.
- You're partway through something and might get interrupted.
- The user gave you a list of things to do.
- You're working on something and discover follow-up work — capture it before
  you forget.

**Skip it when:**
- A task is one or two trivial steps. Just do them.
- The work is purely conversational ("what do you think about X?").

**How to use it well:**
- Call `todo_write` with the WHOLE list every time. Items not in the array
  are deleted.
- Mark a todo `in_progress` BEFORE you start work on it, not after.
- Keep exactly ONE todo `in_progress` at a time. If you really have to
  switch, mark the current one back to `pending` first.
- Mark `completed` IMMEDIATELY after finishing — don't batch updates.
- If you're blocked, partial, or hit an error: keep it `in_progress` and
  tell the user what's blocking. Don't mark it completed.
- Use `active_form` ("Fixing the embedding loader") for the present-tense
  status line, and `content` ("Fix the embedding loader") for the imperative.
- When the list gets fully completed, write an empty list (`todos: []`) to
  clear it, or leave the completed items and add new pending ones — your call.

Status values: `pending`, `in_progress`, `completed`, `cancelled`.
"""


def build_tool_use_preamble() -> str:
    """Return the static tool-use preamble (behavioral instructions + syntax).

    This is the 'how to think about tools' section. Always include it whenever
    any tool is enabled, before the per-tool manifest.
    """
    return _TOOL_USE_PREAMBLE


def build_tool_manifest(tools: List[Dict[str, Any]]) -> str:
    """Build a Claude-Code-style tool manifest for the system prompt.

    Returns the tool-use preamble (behavioral instructions + invocation syntax)
    followed by full per-tool documentation: name, full description, and a
    parameter table with type, required/optional, and description.

    Empty string if no tools are enabled.
    """
    if not tools:
        return ""

    sections: List[str] = [build_tool_use_preamble(), "=== Available Tools ==="]

    for tool in tools:
        fn = tool.get("function", {})
        name = fn.get("name", "?")
        desc = (fn.get("description") or "").strip() or "_(no description)_"
        params_schema = fn.get("parameters", {}) or {}
        props: Dict[str, Any] = params_schema.get("properties", {}) or {}
        required = set(params_schema.get("required", []) or [])

        block: List[str] = [f"## {name}", desc]

        if props:
            block.append("\nParameters:")
            for pname, pinfo in props.items():
                ptype = pinfo.get("type", "any")
                pdesc = (pinfo.get("description") or "").strip()
                req_label = "required" if pname in required else "optional"
                line = f"- `{pname}` ({ptype}, {req_label})"
                if pdesc:
                    line += f": {pdesc}"
                # Show enum constraints if present — helps the model pick valid values.
                if "enum" in pinfo:
                    enum_vals = ", ".join(repr(v) for v in pinfo["enum"])
                    line += f" [one of: {enum_vals}]"
                block.append(line)
        else:
            block.append("\n_(no parameters)_")

        sections.append("\n".join(block))

    return "\n\n".join(sections)


# ============================================================================
# MiniMax Tool Call Parsing
# ============================================================================

def _convert_param_value(value: str, param_type: str) -> Any:
    """Convert a parameter value string to the appropriate Python type."""
    if value.lower() == "null":
        return None
    param_type = param_type.lower()
    if param_type in ("integer", "int"):
        try:
            return int(value)
        except (ValueError, TypeError):
            return value
    if param_type in ("number", "float"):
        try:
            return float(value)
        except (ValueError, TypeError):
            return value
    if param_type == "boolean":
        return value.lower() in ("true", "1")
    if param_type in ("object", "array"):
        try:
            return json.loads(value)
        except (ValueError, TypeError):
            return value
    return value


def parse_minimax_tool_calls(model_output: str, tools: Optional[List[Dict]] = None) -> List[Dict]:
    """Parse MiniMax XML tool calls from model output.

    MiniMax-M2.5 emits tool calls as:
        <minimax:tool_call>
        <invoke name="function_name">
        <parameter name="param1">value1</parameter>
        </invoke>
        </minimax:tool_call>

    Returns a list of {"name": str, "arguments": dict} dicts.
    """
    if "<minimax:tool_call>" not in model_output:
        return []

    # Build param-type map from tool definitions for correct type coercion
    param_types: Dict[str, Dict[str, str]] = {}
    if tools:
        for tool in tools:
            fn = tool.get("function", {})
            name = fn.get("name", "")
            props = fn.get("parameters", {}).get("properties", {})
            param_types[name] = {k: v.get("type", "string") for k, v in props.items()}

    tool_call_re = re.compile(r"<minimax:tool_call>(.*?)</minimax:tool_call>", re.DOTALL)
    invoke_re = re.compile(r"<invoke name=(.*?)</invoke>", re.DOTALL)
    parameter_re = re.compile(r"<parameter name=(.*?)</parameter>", re.DOTALL)

    results = []
    try:
        for tc_block in tool_call_re.findall(model_output):
            for invoke_block in invoke_re.findall(tc_block):
                name_match = re.search(r'^([^>]+)', invoke_block)
                if not name_match:
                    continue
                fn_name = name_match.group(1).strip().strip('"')
                fn_param_types = param_types.get(fn_name, {})

                params: Dict[str, Any] = {}
                for param_block in parameter_re.findall(invoke_block):
                    pm = re.search(r'^([^>]+)>(.*)', param_block, re.DOTALL)
                    if not pm:
                        continue
                    param_name = pm.group(1).strip().strip('"')
                    param_value = pm.group(2).strip()
                    param_type = fn_param_types.get(param_name, "string")
                    params[param_name] = _convert_param_value(param_value, param_type)

                results.append({"name": fn_name, "arguments": params})
    except Exception as e:
        print(f"[tools] Failed to parse tool calls: {e}")

    return results


_TOOL_RESULT_NUDGE = (
    "\n\n[If you have more steps to complete, emit your next "
    "<minimax:tool_call> now. Do NOT narrate the call — produce the XML.]"
)


def format_tool_result_message(tool_name: str, result: Dict[str, Any], tool_call_id: str = "call_0") -> Dict:
    """Wrap a tool result in the MiniMax tool-message format.

    MiniMax expects:
        {"role": "tool", "tool_call_id": "...", "content": [{"name": fn, "type": "text", "text": json_str}]}

    A brief nudge is appended to every tool result reminding the model to
    emit the next tool call as XML rather than narrating it.  This targets
    a known failure mode where the model calls 1-2 tools correctly then
    switches to plain-English descriptions of subsequent calls.
    """
    result_text = json.dumps(result, ensure_ascii=False) + _TOOL_RESULT_NUDGE
    return {
        "role": "tool",
        "tool_call_id": tool_call_id,
        "content": [{
            "name": tool_name,
            "type": "text",
            "text": result_text
        }]
    }


# ============================================================================
# Tool Execution Functions
# ============================================================================

def execute_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    agent_id: UUID,
    db: Session
) -> Dict[str, Any]:
    """Execute a tool call and return the result

    Args:
        tool_name: Name of the tool to execute
        arguments: Tool arguments as dict
        agent_id: ID of the agent making the call
        db: Database session

    Returns:
        Dictionary with tool result
    """

    if tool_name == "list_journal_blocks":
        return list_journal_blocks(agent_id, db)

    elif tool_name == "read_journal_block":
        block_id = arguments.get("id") or arguments.get("block_id")
        return read_journal_block(block_id, db)

    elif tool_name == "create_journal_block":
        return create_journal_block(
            agent_id,
            arguments["label"],
            arguments["value"],
            db
        )

    elif tool_name == "update_journal_block":
        block_id = arguments.get("id") or arguments.get("block_id")
        return update_journal_block(
            block_id,
            arguments.get("label"),
            arguments.get("value"),
            arguments.get("always_in_context"),
            db
        )

    elif tool_name == "delete_journal_block":
        block_id = arguments.get("id") or arguments.get("block_id")
        return delete_journal_block(block_id, db)

    elif tool_name == "search_memories":
        return search_memories(
            agent_id,
            arguments["query"],
            arguments.get("limit", 5),
            db
        )

    elif tool_name == "fetch_memories":
        return fetch_memories(arguments["memory_ids"], db)

    elif tool_name == "get_context_stats":
        return get_context_stats(agent_id, db)

    elif tool_name == "list_rag_files":
        return list_rag_files(agent_id, db)

    elif tool_name == "web_search":
        return web_search(
            arguments["query"],
            arguments.get("max_results", 5)
        )

    elif tool_name == "fetch_url":
        return fetch_url(
            arguments["url"],
            arguments.get("include_links", False)
        )

    # ------------------------------------------------------------------
    # Code agent tools
    # ------------------------------------------------------------------
    elif tool_name == "edit_file":
        return edit_file(
            arguments["path"],
            arguments["old_string"],
            arguments["new_string"],
        )

    elif tool_name == "read_file":
        return read_file(
            arguments["path"],
            offset=arguments.get("offset", 0),
            limit=arguments.get("limit"),
        )

    elif tool_name == "write_file":
        return write_file(arguments["path"], arguments["content"])

    elif tool_name == "list_directory":
        return list_directory(arguments.get("path", "."))

    elif tool_name == "search_files":
        return search_files(
            arguments["pattern"],
            directory=arguments.get("directory", "."),
        )

    elif tool_name == "search_content":
        return search_content(
            arguments["query"],
            path=arguments.get("path", "."),
            file_pattern=arguments.get("file_pattern", "*"),
        )

    elif tool_name == "run_shell":
        return run_shell(
            arguments["command"],
            timeout=arguments.get("timeout", 30),
        )

    # ------------------------------------------------------------------
    # Plugin management
    # ------------------------------------------------------------------
    elif tool_name == "reload_plugins":
        _init_plugins()
        loaded = [t["function"]["name"] for t in PLUGIN_TOOLS]
        return {
            "success": True,
            "plugins_dir": str(PLUGINS_DIR),
            "loaded_tools": loaded,
            "count": len(loaded),
            "message": (
                f"Reloaded {len(loaded)} plugin tool(s): {', '.join(loaded)}"
                if loaded else
                "No plugins found. Create a .py file in backend/services/plugins/ and call reload_plugins again."
            )
        }

    elif tool_name == "reload_skills":
        skills = load_skills()
        summary = [
            {
                "name": s["name"],
                "description": s["description"],
                "path": s["path"],
            }
            for s in skills
        ]
        return {
            "success": True,
            "skills_dir": str(SKILLS_DIR),
            "loaded_skills": summary,
            "count": len(summary),
            "message": (
                f"Loaded {len(summary)} skill(s): {', '.join(s['name'] for s in summary)}"
                if summary else
                "No skills found. Create a SKILL.md in backend/services/plugins/skills/<skill-name>/ and call reload_skills again."
            )
        }

    elif tool_name == "todo_write":
        return todo_write(
            agent_id,
            arguments.get("todos", []),
            db,
        )

    # ------------------------------------------------------------------
    # Plugin-authored tools
    # ------------------------------------------------------------------
    elif tool_name in _plugin_executors:
        try:
            return _plugin_executors[tool_name](tool_name, arguments)
        except Exception as e:
            return {"error": f"Plugin tool '{tool_name}' raised an exception: {e}"}

    else:
        return {"error": f"Unknown tool: {tool_name}"}


# ============================================================================
# Tool Implementation Functions
# ============================================================================

def list_journal_blocks(agent_id: UUID, db: Session) -> Dict[str, Any]:
    """List all journal blocks for the agent"""
    blocks = db.query(JournalBlock).filter(
        JournalBlock.agent_id == agent_id
    ).order_by(JournalBlock.updated_at.desc()).all()

    return {
        "blocks": [
            {
                "id": str(block.id),
                "label": block.label,
                "block_id": block.block_id,
                "always_in_context": block.always_in_context,
                "updated_at": block.updated_at.isoformat() if block.updated_at else None
            }
            for block in blocks
        ]
    }


def read_journal_block(block_id: str, db: Session) -> Dict[str, Any]:
    """Read full content of a journal block"""
    try:
        block = db.query(JournalBlock).filter(
            JournalBlock.id == UUID(block_id)
        ).first()

        if not block:
            return {"error": f"Journal block {block_id} not found"}

        return {
            "id": str(block.id),
            "label": block.label,
            "value": block.value,
            "created_at": block.created_at.isoformat() if block.created_at else None,
            "updated_at": block.updated_at.isoformat() if block.updated_at else None
        }
    except ValueError:
        return {"error": f"Invalid block ID: {block_id}"}


def create_journal_block(
    agent_id: UUID,
    label: str,
    value: str,
    db: Session
) -> Dict[str, Any]:
    """Create a new journal block"""
    # Generate block_id from label
    block_id = JournalBlock.generate_block_id(label)

    # Check if block_id already exists for this agent
    existing = db.query(JournalBlock).filter(
        JournalBlock.agent_id == agent_id,
        JournalBlock.block_id == block_id
    ).first()

    if existing:
        return {
            "error": f"Journal block with label '{label}' (block_id: '{block_id}') already exists. Consider updating it instead or using a different label."
        }

    # Generate embedding for the value
    embedding_service = get_embedding_service()
    block_embedding = embedding_service.embed_text(value)

    block = JournalBlock(
        agent_id=agent_id,
        label=label,
        block_id=block_id,
        value=value,
        embedding=block_embedding,
        editable_by_main_agent=True,  # Main agent can edit blocks it creates
        editable_by_memory_agent=False,
        read_only=False
    )

    db.add(block)
    db.commit()
    db.refresh(block)

    return {
        "success": True,
        "id": str(block.id),
        "block_id": block_id,
        "message": f"Created journal block '{label}' (block_id: {block_id})"
    }


def update_journal_block(
    block_id: str,
    label: Optional[str],
    value: Optional[str],
    always_in_context: Optional[bool],
    db: Session
) -> Dict[str, Any]:
    """Update an existing journal block"""
    try:
        block = db.query(JournalBlock).filter(
            JournalBlock.id == UUID(block_id)
        ).first()

        if not block:
            return {"error": f"Journal block {block_id} not found"}

        # Check permissions
        if block.read_only:
            return {"error": f"Journal block '{block.label}' is read-only and cannot be modified"}

        if not block.editable_by_main_agent:
            return {"error": f"Journal block '{block.label}' cannot be edited by the main agent"}

        if label is not None:
            block.label = label
        if value is not None:
            block.value = value
            # Re-generate embedding if value changed
            embedding_service = get_embedding_service()
            block.embedding = embedding_service.embed_text(value)
        if always_in_context is not None:
            block.always_in_context = always_in_context

        db.commit()

        return {
            "success": True,
            "message": f"Updated journal block '{block.label}' (always_in_context: {block.always_in_context})"
        }
    except ValueError:
        return {"error": f"Invalid block ID: {block_id}"}


def delete_journal_block(block_id: str, db: Session) -> Dict[str, Any]:
    """Delete a journal block"""
    try:
        block = db.query(JournalBlock).filter(
            JournalBlock.id == UUID(block_id)
        ).first()

        if not block:
            return {"error": f"Journal block {block_id} not found"}

        # Check permissions
        if block.read_only:
            return {"error": f"Journal block '{block.label}' is read-only and cannot be deleted"}

        if not block.editable_by_main_agent:
            return {"error": f"Journal block '{block.label}' cannot be deleted by the main agent"}

        label = block.label
        db.delete(block)
        db.commit()

        return {
            "success": True,
            "message": f"Deleted journal block '{label}'"
        }
    except ValueError:
        return {"error": f"Invalid block ID: {block_id}"}


# ============================================================================
# Todo Tool Functions
# ============================================================================

_ALLOWED_TODO_STATUSES = {"pending", "in_progress", "completed", "cancelled"}


def todo_write(agent_id: UUID, todos: List[Dict[str, Any]], db: Session) -> Dict[str, Any]:
    """Atomically replace the agent's todo list with the provided one.

    Claude Code's TodoWrite pattern: the model passes the entire new list every
    call. We wipe the old rows for this agent and insert the new ones in order.
    """
    from backend.db.models.todo import Todo, TodoStatus

    if not isinstance(todos, list):
        return {"error": "todos must be a list"}

    # Validate first — if anything is bad, reject the whole write so we don't
    # leave the list in a half-updated state.
    normalized: List[Dict[str, Any]] = []
    for i, raw in enumerate(todos):
        if not isinstance(raw, dict):
            return {"error": f"todos[{i}] must be an object, got {type(raw).__name__}"}
        content = (raw.get("content") or "").strip()
        if not content:
            return {"error": f"todos[{i}].content is required"}
        status = (raw.get("status") or "pending").strip()
        if status not in _ALLOWED_TODO_STATUSES:
            return {
                "error": (
                    f"todos[{i}].status={status!r} is invalid. "
                    f"Must be one of: {sorted(_ALLOWED_TODO_STATUSES)}"
                )
            }
        active_form = raw.get("active_form")
        if active_form is not None:
            active_form = str(active_form).strip() or None
        normalized.append(
            {
                "content": content,
                "active_form": active_form,
                "status": status,
            }
        )

    # Soft warning (not an error) if more than one in_progress — Kevin can fix
    # in his next write, but we surface it so he notices.
    in_progress_count = sum(1 for t in normalized if t["status"] == "in_progress")
    warning = None
    if in_progress_count > 1:
        warning = (
            f"You have {in_progress_count} todos in_progress. "
            "Keep exactly one in_progress at a time so you stay focused."
        )

    # Wipe + insert. Using delete() on the query rather than per-row for speed.
    try:
        db.query(Todo).filter(Todo.agent_id == agent_id).delete(synchronize_session=False)
        for i, t in enumerate(normalized):
            db.add(
                Todo(
                    agent_id=agent_id,
                    content=t["content"],
                    active_form=t["active_form"],
                    status=TodoStatus(t["status"]),
                    sort_order=i,
                )
            )
        db.commit()
    except Exception as e:
        db.rollback()
        return {"error": f"Failed to write todos: {e}"}

    result = {
        "success": True,
        "count": len(normalized),
        "todos": normalized,
    }
    if warning:
        result["warning"] = warning
    return result


def get_active_todos(agent_id: UUID, db: Session) -> List[Dict[str, Any]]:
    """Return non-cancelled todos for the agent, ordered by sort_order.

    Completed items are kept so the model can see what's already done in this
    workstream. Cancelled items are hidden to keep the working set clean.
    """
    from backend.db.models.todo import Todo, TodoStatus

    rows = (
        db.query(Todo)
        .filter(Todo.agent_id == agent_id)
        .filter(Todo.status != TodoStatus.cancelled)
        .order_by(Todo.sort_order.asc())
        .all()
    )
    return [r.to_dict() for r in rows]


def format_todos_for_prompt(todos: List[Dict[str, Any]]) -> str:
    """Render the active todo list as a compact markdown checklist.

    Empty string if the list is empty so we don't pollute the prompt.
    """
    if not todos:
        return ""
    glyphs = {
        "pending": "[ ]",
        "in_progress": "[~]",
        "completed": "[x]",
        "cancelled": "[-]",
    }
    lines = ["=== Your Todo List ==="]
    for t in todos:
        glyph = glyphs.get(t.get("status", "pending"), "[ ]")
        text = t.get("content", "").strip()
        # Use active_form when in_progress so the running task reads naturally.
        if t.get("status") == "in_progress" and t.get("active_form"):
            text = t["active_form"].strip()
        lines.append(f"{glyph} {text}")
    return "\n".join(lines)


# ============================================================================
# Memory Search Tool Functions
# ============================================================================

def search_memories(
    agent_id: UUID,
    query: str,
    limit: int,
    db: Session
) -> Dict[str, Any]:
    """Search across all memories using semantic similarity"""
    try:
        # Use the memory service to search
        candidates = search_memories_service(query, agent_id, db, limit=limit)

        return {
            "memories": [
                {
                    "id": candidate.id,
                    "source_type": candidate.source_type,
                    "content": candidate.content,
                    "similarity_score": candidate.similarity_score,
                    "metadata": candidate.metadata
                }
                for candidate in candidates
            ],
            "count": len(candidates)
        }
    except Exception as e:
        return {"error": f"Memory search failed: {str(e)}"}


def fetch_memories(memory_ids: List[str], db: Session) -> Dict[str, Any]:
    """Fetch full content of specific memories by ID"""
    try:
        memories = fetch_full_memories(memory_ids, db)
        return {
            "memories": memories,
            "count": len(memories)
        }
    except Exception as e:
        return {"error": f"Failed to fetch memories: {str(e)}"}


def get_context_stats(agent_id: UUID, db: Session) -> Dict[str, Any]:
    """Get statistics about context window usage"""
    from backend.db.models.agent import Agent
    
    # Get agent info
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        return {"error": "Agent not found"}
    
    max_context_tokens = agent.max_context_tokens
    
    # Get pinned (always in context) blocks
    pinned_blocks = db.query(JournalBlock).filter(
        JournalBlock.agent_id == agent_id,
        JournalBlock.always_in_context == True
    ).all()
    
    # Get unpinned but attached blocks (in RAG)
    unpinned_blocks = db.query(JournalBlock).filter(
        JournalBlock.agent_id == agent_id,
        JournalBlock.always_in_context == False,
        JournalBlock.attached == True
    ).all()
    
    # Calculate rough token estimates (roughly 1 token = 4 characters)
    pinned_chars = sum(len(b.value) for b in pinned_blocks)
    pinned_estimate = pinned_chars // 4
    unpinned_chars = sum(len(b.value) for b in unpinned_blocks)
    unpinned_estimate = unpinned_chars // 4
    
    return {
        "max_context_tokens": max_context_tokens,
        "pinned_blocks": {
            "count": len(pinned_blocks),
            "estimated_tokens": pinned_estimate,
            "blocks": [{"id": str(b.id), "label": b.label} for b in pinned_blocks]
        },
        "rag_blocks": {
            "count": len(unpinned_blocks),
            "estimated_tokens": unpinned_estimate,
            "blocks": [{"id": str(b.id), "label": b.label} for b in unpinned_blocks]
        },
        "summary": f"Agent has {max_context_tokens} max context tokens. "
                   f"{len(pinned_blocks)} blocks pinned (~{pinned_estimate} tokens), "
                   f"{len(unpinned_blocks)} blocks in RAG (~{unpinned_estimate} tokens, searchable but not in context)."
    }


def list_rag_files(agent_id: UUID, db: Session) -> Dict[str, Any]:
    """List all RAG files/folders attached to this agent"""
    try:
        query = text("""
            SELECT
                folder.id as folder_id,
                folder.name as folder_name,
                COUNT(DISTINCT file.id) as file_count,
                COUNT(DISTINCT chunk.id) as chunk_count
            FROM rag_folders folder
            LEFT JOIN rag_files file ON file.folder_id = folder.id
            LEFT JOIN rag_chunks chunk ON chunk.file_id = file.id
            WHERE folder.agent_id = :agent_id
            GROUP BY folder.id, folder.name
            ORDER BY folder.name
        """)

        results = db.execute(query, {"agent_id": str(agent_id)}).fetchall()

        folders = [
            {
                "folder_id": str(row.folder_id),
                "folder_name": row.folder_name,
                "file_count": row.file_count or 0,
                "chunk_count": row.chunk_count or 0
            }
            for row in results
        ]

        # Also get individual files
        files_query = text("""
            SELECT
                file.id,
                file.filename,
                file.folder_id,
                COUNT(chunk.id) as chunk_count
            FROM rag_files file
            JOIN rag_folders folder ON file.folder_id = folder.id
            LEFT JOIN rag_chunks chunk ON chunk.file_id = file.id
            WHERE folder.agent_id = :agent_id
            GROUP BY file.id, file.filename, file.folder_id
            ORDER BY file.filename
        """)

        file_results = db.execute(files_query, {"agent_id": str(agent_id)}).fetchall()

        files = [
            {
                "file_id": str(row.id),
                "filename": row.filename,
                "folder_id": str(row.folder_id),
                "chunk_count": row.chunk_count or 0
            }
            for row in file_results
        ]

        return {
            "folders": folders,
            "files": files,
            "total_folders": len(folders),
            "total_files": len(files)
        }
    except Exception as e:
        return {"error": f"Failed to list RAG files: {str(e)}"}


# ============================================================================
# Web Search and Fetch Tools
# ============================================================================

def web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    """Search the web using DuckDuckGo"""
    try:
        # Check cache first
        cache_key = f"search:{query}:{max_results}"
        if cache_key in _web_cache:
            return _web_cache[cache_key]

        # Lazy import to avoid startup cost
        from ddgs import DDGS

        # Clamp max_results
        max_results = min(max(1, max_results), 10)

        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))

        formatted_results = [
            {
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", "")
            }
            for r in results
        ]

        response = {
            "query": query,
            "results": formatted_results,
            "count": len(formatted_results)
        }

        # Cache the result
        _web_cache[cache_key] = response
        return response

    except Exception as e:
        return {"error": f"Web search failed: {str(e)}"}


def fetch_url(url: str, include_links: bool = False) -> Dict[str, Any]:
    """Fetch and extract main content from a web page"""
    try:
        # Check cache first
        cache_key = f"fetch:{url}:{include_links}"
        if cache_key in _web_cache:
            return _web_cache[cache_key]

        # Lazy import
        import trafilatura
        from trafilatura.settings import use_config

        # Configure trafilatura
        config = use_config()
        config.set("DEFAULT", "EXTRACTION_TIMEOUT", "30")

        # Download the page
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return {"error": f"Failed to download page: {url}"}

        # Extract main content as markdown
        content = trafilatura.extract(
            downloaded,
            output_format="markdown",
            include_links=include_links,
            include_tables=True,
            favor_precision=True,
            config=config
        )

        if not content:
            return {"error": f"Failed to extract content from: {url}"}

        # Get metadata (title, etc.)
        metadata = trafilatura.extract_metadata(downloaded)
        title = metadata.title if metadata else "Unknown"

        # Truncate if too long (avoid massive responses)
        max_chars = 50000
        truncated = False
        if len(content) > max_chars:
            content = content[:max_chars] + "\n\n[Content truncated...]"
            truncated = True

        response = {
            "url": url,
            "title": title,
            "content": content,
            "truncated": truncated,
            "character_count": len(content)
        }

        # Optionally extract links
        if include_links:
            # Extract all links from the page
            from trafilatura import extract
            links_content = extract(
                downloaded,
                output_format="xml",
                include_links=True
            )
            # Parse links if needed (simplified for now)
            response["links_included"] = True

        # Cache the result
        _web_cache[cache_key] = response
        return response

    except Exception as e:
        return {"error": f"Failed to fetch URL: {str(e)}"}
