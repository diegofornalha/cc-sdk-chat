# MCP types stub for Python 3.9 compatibility
from typing import Any, Dict

class TextContent:
    """Stub for MCP TextContent"""
    pass

class Tool:
    """Stub for MCP Tool"""
    pass

class CallToolResult:
    """Stub for MCP CallToolResult"""
    pass

class ListResourcesResult:
    """Stub for MCP ListResourcesResult"""
    pass

class ListPromptsResult:
    """Stub for MCP ListPromptsResult"""
    pass

class ListToolsResult:
    """Stub for MCP ListToolsResult"""
    pass

class GetPromptResult:
    """Stub for MCP GetPromptResult"""
    pass

class ReadResourceResult:
    """Stub for MCP ReadResourceResult"""
    pass

class CompleteResult:
    """Stub for MCP CompleteResult"""
    pass

class CallToolRequest:
    """Stub for MCP CallToolRequest"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class CallToolRequestParams:
    """Stub for MCP CallToolRequestParams"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class ListResourcesRequest:
    """Stub for MCP ListResourcesRequest"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class ListPromptsRequest:
    """Stub for MCP ListPromptsRequest"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class ListToolsRequest:
    """Stub for MCP ListToolsRequest"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class GetPromptRequest:
    """Stub for MCP GetPromptRequest"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class ReadResourceRequest:
    """Stub for MCP ReadResourceRequest"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class CompleteRequest:
    """Stub for MCP CompleteRequest"""
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)