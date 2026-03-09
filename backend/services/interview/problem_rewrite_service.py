"""
LLM layer: rewrite LeetCode problems into story-based descriptions (anti-cheat)
and generate function-only boilerplate with canonical I/O format.

Canonical I/O:
- Stdin: one line per function argument, each line valid JSON. Order = parameter order.
- Stdout: single line, JSON (or repr) of return value.

Function signature schema:
  { "name": str, "params": [{"name": str, "type": str}], "return_type": str }
"""

import json
from typing import Any, Dict, List, Optional

from utils.logger import get_logger

logger = get_logger("ProblemRewriteService")

# Fallback when rewrite fails or signature missing
DEFAULT_FUNCTION_SIGNATURE = {
    "name": "solve",
    "params": [{"name": "nums", "type": "list[int]"}, {"name": "target", "type": "int"}],
    "return_type": "list[int]",
}


def _get_groq():
    from services.integrations.groq_service import GroqService
    return GroqService()


async def rewrite_to_story(question_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Rewrite the problem into a different domain/story while keeping the same
    function contract. Returns updated question_data with rewritten title,
    description, and function_signature. On failure, keeps original and sets
    a default function_signature.
    """
    title = question_data.get("title", "")
    # Use plain text for the LLM (no HTML)
    description = question_data.get("description_plain") or question_data.get("description", "")
    if isinstance(description, str) and len(description) > 4000:
        description = description[:4000] + "..."

    # Save originals for test case generation
    question_data["_original_title"] = title
    question_data["_original_description"] = description

    system_prompt = """You are a coding-interview problem writer. Your task is to REWRITE a given coding problem so that:
1. The problem is described as a STORY or different software concept (e.g. cache eviction, event scheduling, config validation) — NOT the classic algorithm name or "given an array".
2. The function signature and semantics stay EXACTLY the same: same number and types of parameters, same return type, same algorithm to solve it. Only the narrative changes.
3. The rewritten description must NOT use the original problem name or well-known phrasing (e.g. no "Two Sum", no "given an array of integers" in the same form). So if someone pastes ONLY your rewritten description into another LLM, that LLM should not reliably recognize the problem and may give a wrong solution.
4. Output ONLY valid JSON with no markdown, no backticks: {"rewritten_title": "...", "rewritten_description": "...", "function_signature": {"name": "...", "params": [{"name": "...", "type": "..."}, ...], "return_type": "..."}}.
5. rewritten_description must be plain text or markdown (no HTML). Keep constraints and examples logically equivalent."""

    user_prompt = f"""Original title: {title}

Original description:
{description}

Return JSON: rewritten_title, rewritten_description (plain text), and function_signature with name, params (list of {{name, type}}), and return_type. Preserve the exact contract so test cases (stdin: one JSON line per param, stdout: one JSON line for return value) still apply."""

    try:
        groq = _get_groq()
        raw = await groq.json_completion(system_prompt, user_prompt)
        data = json.loads(raw) if isinstance(raw, str) else raw

        rewritten_title = data.get("rewritten_title") or title
        rewritten_description = data.get("rewritten_description") or description
        sig = data.get("function_signature")
        if not sig or not isinstance(sig, dict) or not sig.get("name"):
            sig = DEFAULT_FUNCTION_SIGNATURE
        if not isinstance(sig.get("params"), list):
            sig["params"] = DEFAULT_FUNCTION_SIGNATURE["params"]
        if not sig.get("return_type"):
            sig["return_type"] = DEFAULT_FUNCTION_SIGNATURE["return_type"]

        question_data["title"] = rewritten_title
        question_data["description"] = rewritten_description
        question_data["description_is_html"] = False
        question_data["description_plain"] = rewritten_description
        question_data["function_signature"] = sig
        logger.info("Rewrote problem to story: %s -> %s", title[:40], rewritten_title[:40])
        return question_data
    except Exception as e:
        logger.warning("Problem rewrite failed (%s), keeping original", e, exc_info=True)
        question_data["function_signature"] = DEFAULT_FUNCTION_SIGNATURE
        return question_data


def _default_return_for_type(return_type: str) -> str:
    """Return 'dict' or 'list' for stub default (return {} vs return [])."""
    if not return_type:
        return "list"
    rt = return_type.lower().strip()
    if rt in ("object", "dict", "dict[str, any]", "dict[str,list]", "{}"):
        return "dict"
    if "object" in rt or "dict" in rt:
        return "dict"
    return "list"


def _normalize_schema_type(t: str) -> str:
    """Normalize schema type string for mapping."""
    if not t:
        return "any"
    return t.lower().strip().replace(" ", "")


def _schema_type_to_cpp(schema_type: str) -> str:
    """Map schema type to C++ native type. Fallback: json (use const json& in signature)."""
    n = _normalize_schema_type(schema_type)
    if n in ("list[int]", "array<int>", "listint"):
        return "std::vector<int>"
    if n in ("list[list[int]]", "listlist[int]", "listlistint"):
        return "std::vector<std::vector<int>>"
    if n in ("int", "integer", "long"):
        return "int"
    if n in ("str", "string"):
        return "std::string"
    if n == "bool":
        return "bool"
    return "json"  # fallback: use nlohmann json in signature


def _schema_type_to_java(schema_type: str) -> str:
    """Map schema type to Java native type. Fallback: Object."""
    n = _normalize_schema_type(schema_type)
    if n in ("list[int]", "array<int>", "listint"):
        return "List<Integer>"
    if n in ("list[list[int]]", "listlist[int]", "listlistint"):
        return "List<List<Integer>>"
    if n in ("int", "integer", "long"):
        return "Integer"
    if n in ("str", "string"):
        return "String"
    if n == "bool":
        return "Boolean"
    return "Object"


def _schema_type_to_rust(schema_type: str) -> str:
    """Map schema type to Rust native type. Fallback: Value."""
    n = _normalize_schema_type(schema_type)
    if n in ("list[int]", "array<int>", "listint"):
        return "Vec<i32>"
    if n in ("list[list[int]]", "listlist[int]", "listlistint"):
        return "Vec<Vec<i32>>"
    if n in ("int", "integer", "long"):
        return "i32"
    if n in ("str", "string"):
        return "String"
    if n == "bool":
        return "bool"
    return "Value"


def _schema_type_to_go(schema_type: str) -> str:
    """Map schema type to Go native type. Fallback: interface{}."""
    n = _normalize_schema_type(schema_type)
    if n in ("list[int]", "array<int>", "listint"):
        return "[]int"
    if n in ("list[list[int]]", "listlist[int]", "listlistint"):
        return "[][]int"
    if n in ("int", "integer", "long"):
        return "int"
    if n in ("str", "string"):
        return "string"
    if n == "bool":
        return "bool"
    return "interface{}"


def _schema_type_to_c(schema_type: str) -> str:
    """Map schema type to C. Native only for int/string; rest use cJSON*."""
    n = _normalize_schema_type(schema_type)
    if n in ("int", "integer", "long"):
        return "int"
    if n in ("str", "string"):
        return "char*"
    if n == "bool":
        return "int"
    return "cJSON*"


# Languages that get full canonical I/O boilerplate (stdin: one JSON line per param, stdout: one JSON line).
SUPPORTED_STARTER_LANGUAGES = ("python", "javascript", "go", "java", "cpp", "c", "rust")


def generate_starter_code(question_data: Dict[str, Any]) -> Dict[str, str]:
    """
    Generate LeetCode-style starter code: one function stub + driver that reads
    stdin (one JSON line per param), calls the function, prints one JSON line.
    Returns entries for all SUPPORTED_STARTER_LANGUAGES (python, javascript, go, java, cpp, c, rust).
    Handles both list and object return types (e.g. {"customer_id": [...]}).
    """
    sig = question_data.get("function_signature") or DEFAULT_FUNCTION_SIGNATURE
    name = sig.get("name") or "solve"
    params = sig.get("params") or []
    return_type = (sig.get("return_type") or "any")
    default_return = _default_return_for_type(return_type)

    param_names = [p.get("name") or f"arg{i}" for i, p in enumerate(params)]
    param_list = ", ".join(param_names)
    out: Dict[str, str] = {}

    templates = {
        "python": _python_template(name, param_list, param_names, params, return_type, default_return),
        "javascript": _javascript_template(name, param_list, param_names, params, return_type, default_return),
        "go": _go_template(name, param_list, param_names, params, return_type, default_return),
        "java": _java_template(name, param_list, param_names, params, return_type, default_return),
        "cpp": _cpp_template(name, param_list, param_names, params, return_type, default_return),
        "c": _c_template(name, param_list, param_names, params, return_type, default_return),
        "rust": _rust_template(name, param_list, param_names, params, return_type, default_return),
    }
    default_code = question_data.get("starter_code") or {}
    for lang in SUPPORTED_STARTER_LANGUAGES:
        if lang in default_code and default_code[lang]:
            out[lang] = default_code[lang]
        elif lang in templates:
            out[lang] = templates[lang]
    return out


def _python_template(
    func_name: str,
    param_list: str,
    param_names: List[str],
    params: List[Dict[str, Any]],
    return_type: str,
    default_return: str = "list",
) -> str:
    stub_return = "{}" if default_return == "dict" else "[]"
    # Optional type hints from schema (use with from __future__ import annotations for 3.7+)
    type_hints = []
    for i, p in enumerate(params):
        t = (p.get("type") or "").strip().lower().replace(" ", "")
        if t in ("list[int]", "list[list[int]]", "int", "str", "bool", "integer", "string"):
            type_hints.append(t)
        else:
            type_hints.append("")
    use_hints = any(type_hints)
    sig_params = ", ".join(f"{name}: {th}" if th else name for name, th in zip(param_names, type_hints))
    if not sig_params:
        sig_params = param_list
    lines = []
    if use_hints:
        lines.append("from __future__ import annotations")
    lines.extend([
        "import json",
        "import sys",
        "",
        f"def {func_name}({sig_params}):",
        "    # Implement this function. Do not change the signature.",
        f"    return {stub_return}",
        "",
        'if __name__ == "__main__":',
        "    data = sys.stdin.read().strip().split(\"\\n\")",
    ])
    for i, p in enumerate(param_names):
        if i == 0:
            lines.append(f"    {p} = json.loads(data[{i}])")
        else:
            lines.append(f"    {p} = json.loads(data[{i}]) if len(data) > {i} else None")
    lines.append(f"    result = {func_name}({param_list})")
    lines.append("    print(json.dumps(result))")
    return "\n".join(lines)


def _javascript_template(
    func_name: str,
    param_list: str,
    param_names: List[str],
    params: List[Dict[str, Any]],
    return_type: str,
    default_return: str = "list",
) -> str:
    stub_return = "{}" if default_return == "dict" else "[]"
    # Node: read stdin synchronously for Judge0 (stdin fd 0); signature stays native (params are just names)
    lines = [
        "const fs = require('fs');",
        "const input = fs.readFileSync(0, 'utf8').trim().split('\\n');",
        "const parsed = input.map((line) => JSON.parse(line));",
        f"const result = {func_name}(...parsed);",
        "console.log(JSON.stringify(result));",
        "",
        f"function {func_name}({param_list}) {{",
        "  // Implement this function. Do not change the signature.",
        f"  return {stub_return};",
        "}",
    ]
    return "\n".join(lines)


def _go_template(
    func_name: str,
    param_list: str,
    param_names: List[str],
    params: List[Dict[str, Any]],
    return_type: str,
    default_return: str = "list",
) -> str:
    stub_return = "map[string]interface{}{}" if default_return == "dict" else "[]interface{}{}"
    param_types = [_schema_type_to_go(p.get("type") or "any") for p in params]
    param_list_go = ", ".join(f"{name} {pt}" for name, pt in zip(param_names, param_types))
    lines = [
        'package main',
        '',
        'import (',
        '\t"bufio"',
        '\t"encoding/json"',
        '\t"fmt"',
        '\t"os"',
        ')',
        '',
        f'func {func_name}({param_list_go}) interface{{}} {{',
        '\t// Implement this function. Do not change the signature.',
        f'\treturn {stub_return}',
        '}',
        '',
        'func main() {',
        '\tscanner := bufio.NewScanner(os.Stdin)',
        '\tvar lines []string',
        '\tfor scanner.Scan() {',
        '\t\tlines = append(lines, scanner.Text())',
        '\t}',
        '\tif err := scanner.Err(); err != nil {',
        '\t\tfmt.Fprintf(os.Stderr, "read error: %v\\n", err)',
        '\t\tos.Exit(1)',
        '\t}',
    ]
    for i, (p, pt) in enumerate(zip(param_names, param_types)):
        lines.append(f'\tvar {p} {pt}')
        lines.append(f'\tif len(lines) > {i} {{')
        lines.append(f'\t\tif err := json.Unmarshal([]byte(lines[{i}]), &{p}); err != nil {{')
        lines.append(f'\t\t\tfmt.Fprintf(os.Stderr, "json error: %v\\n", err)')
        lines.append(f'\t\t\tos.Exit(1)')
        lines.append(f'\t\t}}')
        lines.append(f'\t}}')
    args_str = ", ".join(param_names)
    lines.append(f'\tresult := {func_name}({args_str})')
    lines.append('\tout, _ := json.Marshal(result)')
    lines.append('\tfmt.Println(string(out))')
    lines.append('}')
    return "\n".join(lines)


def _java_read_expr(i: int, param_name: str, java_type: str) -> str:
    """Generate Java expression to read one line into the given type."""
    if java_type == "List<Integer>":
        return f"mapper.readValue(lines[{i}], new TypeReference<List<Integer>>(){{}})"
    if java_type == "List<List<Integer>>":
        return f"mapper.readValue(lines[{i}], new TypeReference<List<List<Integer>>>(){{}})"
    if java_type == "Integer":
        return f"lines.length > {i} ? mapper.readValue(lines[{i}], Integer.class) : null"
    if java_type == "String":
        return f"lines.length > {i} ? mapper.readValue(lines[{i}], String.class) : null"
    if java_type == "Boolean":
        return f"lines.length > {i} ? mapper.readValue(lines[{i}], Boolean.class) : null"
    return f"lines.length > {i} ? mapper.readValue(lines[{i}], Object.class) : null"


def _java_template(
    func_name: str,
    param_list: str,
    param_names: List[str],
    params: List[Dict[str, Any]],
    return_type: str,
    default_return: str = "list",
) -> str:
    stub_return = "new java.util.HashMap<String,Object>()" if default_return == "dict" else "new java.util.ArrayList<>()"
    param_types = [_schema_type_to_java(p.get("type") or "any") for p in params]
    param_decls = ", ".join(f"{jt} {p}" for jt, p in zip(param_types, param_names))
    n = len(param_names)
    lines = [
        "import java.util.*;",
        "import com.fasterxml.jackson.databind.ObjectMapper;",
        "import com.fasterxml.jackson.core.type.TypeReference;",
        "",
        "public class Main {",
        "    private static final ObjectMapper mapper = new ObjectMapper();",
        "",
        f"    public static Object {func_name}({param_decls}) {{",
        "        // Implement this function. Do not change the signature.",
        f"        return {stub_return};",
        "    }",
        "",
        "    public static void main(String[] args) throws Exception {",
        "        java.util.Scanner sc = new java.util.Scanner(System.in).useDelimiter(\"\\\\A\");",
        "        String raw = sc.hasNext() ? sc.next().trim() : \"\";",
        "        sc.close();",
        "        String[] lines = raw.isEmpty() ? new String[0] : raw.split(\"\\\\n\");",
        "",
    ]
    for i, (p, jt) in enumerate(zip(param_names, param_types)):
        read_expr = _java_read_expr(i, p, jt)
        lines.append(f"        {jt} {p} = {read_expr};")
    call_args = ", ".join(param_names)
    lines.append(f"        Object result = {func_name}({call_args});")
    lines.append("        System.out.println(mapper.writeValueAsString(result));")
    lines.append("    }")
    lines.append("}")
    return "\n".join(lines)


def _cpp_template(
    func_name: str,
    param_list: str,
    param_names: List[str],
    params: List[Dict[str, Any]],
    return_type: str,
    default_return: str = "list",
) -> str:
    param_types = [_schema_type_to_cpp(p.get("type") or "any") for p in params]
    ret_cpp = _schema_type_to_cpp(return_type)
    n = len(param_names)

    # Stub return: native type literal
    if ret_cpp == "json":
        stub_return = "{}" if default_return == "dict" else "json::array()"
    elif ret_cpp == "std::vector<int>":
        stub_return = "{}"
    elif ret_cpp == "std::vector<std::vector<int>>":
        stub_return = "{}"
    else:
        stub_return = "0" if ret_cpp == "int" else '""' if ret_cpp == "std::string" else "false"

    # Build signature with native types
    sig_parts = [f"const {pt}& {name}" if pt != "int" and pt != "bool" else f"{pt} {name}"
                 for pt, name in zip(param_types, param_names)]
    sig_str = ", ".join(sig_parts)

    # Conversion helpers (only for types we use)
    used_types = set(param_types) | {ret_cpp}
    helpers = []
    if "std::vector<int>" in used_types:
        helpers.extend([
            "static std::vector<int> from_json_vec(const json& j) {",
            "    std::vector<int> v; if (!j.is_array()) return v;",
            "    for (auto& x : j) v.push_back(x.get<int>()); return v;",
            "}",
            "static json to_json(const std::vector<int>& v) { json j = json::array(); for (int x : v) j.push_back(x); return j; }",
            "",
        ])
    if "std::vector<std::vector<int>>" in used_types:
        helpers.extend([
            "static std::vector<std::vector<int>> from_json_vecvec(const json& j) {",
            "    std::vector<std::vector<int>> v; if (!j.is_array()) return v;",
            "    for (auto& row : j) v.push_back(from_json_vec(row)); return v;",
            "}",
            "static json to_json(const std::vector<std::vector<int>>& v) { json j = json::array(); for (auto& row : v) j.push_back(to_json(row)); return j; }",
            "",
        ])

    # Convert one parsed json to native type (expression string for main)
    def cpp_parse_expr(i: int, pt: str) -> str:
        j = f"(parsed.size() > {i} ? parsed[{i}] : json())"
        if pt == "std::vector<int>":
            return f"from_json_vec({j})"
        if pt == "std::vector<std::vector<int>>":
            return f"from_json_vecvec({j})"
        if pt == "int":
            return f"{j}.get<int>()"
        if pt == "std::string":
            return f"{j}.get<std::string>()"
        if pt == "bool":
            return f"{j}.get<bool>()"
        return j  # json

    # Convert native result to json (expression)
    def cpp_to_json_expr(var: str, pt: str) -> str:
        if pt in ("std::vector<int>", "std::vector<std::vector<int>>"):
            return f"to_json({var})"
        if pt in ("int", "std::string", "bool"):
            return f"json({var})"
        return var

    call_parts = [cpp_parse_expr(i, pt) for i, pt in enumerate(param_types)]
    call_str = ", ".join(call_parts)
    result_var = "result"
    result_to_json = cpp_to_json_expr(result_var, ret_cpp)

    lines = [
        "#include <iostream>",
        "#include <string>",
        "#include <vector>",
        "#include <nlohmann/json.hpp>",
        "using json = nlohmann::json;",
        "",
    ]
    lines.extend(helpers)
    lines.extend([
        f"{ret_cpp} {func_name}({sig_str}) {{",
        "    // Implement this function. Do not change the signature.",
        f"    return {stub_return};",
        "}",
        "",
        "int main() {",
        "    std::string line;",
        "    std::vector<std::string> lines;",
        "    while (std::getline(std::cin, line))",
        "        if (!line.empty() || lines.size() < 1) lines.push_back(line);",
        "    std::vector<json> parsed;",
        "    for (const auto& l : lines) {",
        "        try { parsed.push_back(json::parse(l)); }",
        "        catch (...) { parsed.push_back(json{}); }",
        "    }",
        f"    {ret_cpp} {result_var} = {func_name}({call_str});",
        f"    std::cout << {result_to_json}.dump() << std::endl;",
        "    return 0;",
        "}",
    ])
    return "\n".join(lines)


def _c_template(
    func_name: str,
    param_list: str,
    param_names: List[str],
    params: List[Dict[str, Any]],
    return_type: str,
    default_return: str = "list",
) -> str:
    stub_ret = "cJSON_CreateObject()" if default_return == "dict" else "cJSON_CreateArray()"
    param_types = [_schema_type_to_c(p.get("type") or "any") for p in params]
    param_decls = ", ".join(f"{ct} {p}" for ct, p in zip(param_types, param_names))

    # In C we still parse to cJSON* in main; then convert to native for int/char*/int(bool)
    call_parts = []
    for j, (pt, name) in enumerate(zip(param_types, param_names)):
        if pt == "int":
            call_parts.append(f"(int)(cJSON_GetNumberValue(parsed[{j}]))")
        elif pt == "char*":
            call_parts.append(f"(parsed[{j}] && cJSON_IsString(parsed[{j}])) ? strdup(cJSON_GetStringValue(parsed[{j}])) : strdup(\"\")")
        elif pt == "cJSON*":
            call_parts.append(f"parsed[{j}] ? parsed[{j}] : cJSON_CreateNull()")
        else:
            call_parts.append(f"parsed[{j}] ? parsed[{j}] : cJSON_CreateNull()")
    call_args = ", ".join(call_parts)

    lines = [
        "#include <stdio.h>",
        "#include <stdlib.h>",
        "#include <string.h>",
        "#include <cJSON.h>",
        "",
        f"cJSON* {func_name}({param_decls}) {{",
        "    /* Implement this function. Do not change the signature. */",
        f"    return {stub_ret};",
        "}",
        "",
        "int main() {",
        "    char buf[1024 * 64];",
        "    cJSON* parsed[16];",
        "    int i = 0;",
        "    while (fgets(buf, sizeof(buf), stdin) && i < 16) {",
        "        size_t len = strlen(buf);",
        "        while (len && (buf[len-1] == '\\n' || buf[len-1] == '\\r')) buf[--len] = 0;",
        "        parsed[i] = cJSON_Parse(buf);",
        "        if (!parsed[i]) parsed[i] = cJSON_CreateNull();",
        "        i++;",
        "    }",
        f"    cJSON* result = {func_name}({call_args});",
        "    char* out = cJSON_PrintUnformatted(result);",
        "    if (out) { puts(out); free(out); }",
        "    for (int j = 0; j < i; j++) cJSON_Delete(parsed[j]);",
        "    cJSON_Delete(result);",
        "    return 0;",
        "}",
    ]
    return "\n".join(lines)


def _rust_template(
    func_name: str,
    param_list: str,
    param_names: List[str],
    params: List[Dict[str, Any]],
    return_type: str,
    default_return: str = "list",
) -> str:
    param_types = [_schema_type_to_rust(p.get("type") or "any") for p in params]
    ret_rust = _schema_type_to_rust(return_type)
    params_typed = ", ".join(f"{p}: {rt}" for p, rt in zip(param_names, param_types))

    if ret_rust == "Value":
        stub_return = "serde_json::json!({})" if default_return == "dict" else "serde_json::json!([])"
        stub_body = f"{stub_return}.clone()"
    elif ret_rust == "Vec<i32>":
        stub_body = "vec![]"
    elif ret_rust == "Vec<Vec<i32>>":
        stub_body = "vec![]"
    elif ret_rust == "i32":
        stub_body = "0"
    elif ret_rust == "String":
        stub_body = "String::new()"
    elif ret_rust == "bool":
        stub_body = "false"
    else:
        stub_body = "serde_json::Value::Null"

    def rust_parse_line(i: int, rt: str) -> str:
        if rt == "Value":
            return f"lines.get({i}).and_then(|s| serde_json::from_str(s).ok()).unwrap_or(serde_json::Value::Null)"
        return f"lines.get({i}).and_then(|s| serde_json::from_str(s).ok()).unwrap_or_default()"

    call_args = ", ".join(rust_parse_line(i, rt) for i, rt in enumerate(param_types))

    # Output: native types implement Serialize so we can use to_string
    if ret_rust == "Value":
        print_result = "println!(\"{}\", result);"
    else:
        print_result = "println!(\"{}\", serde_json::to_string(&result).unwrap_or_default());"

    use_value = "Value" in param_types or ret_rust == "Value"
    use_serde = [
        "use serde::{Deserialize, Serialize};",
        "use std::io::{self, BufRead};",
    ]
    if use_value:
        use_serde.insert(0, "use serde_json::Value;")
    lines = use_serde + [
        "",
        "",
        f"fn {func_name}({params_typed}) -> {ret_rust} {{",
        "    // Implement this function. Do not change the signature.",
        f"    {stub_body}",
        "}",
        "",
        "fn main() {",
        "    let stdin = io::stdin();",
        "    let lines: Vec<String> = stdin.lock().lines().filter_map(|l| l.ok()).collect();",
        f"    let result = {func_name}({call_args});",
        f"    {print_result}",
        "}",
    ]
    return "\n".join(lines)

