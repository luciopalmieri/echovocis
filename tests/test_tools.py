from src.agent.tools import get_tools


def test_get_tools_returns_five():
    tools = get_tools()
    assert len(tools) == 5
    names = [t.name for t in tools]
    assert "save_mistake" in names
    assert "get_user_history" in names
    assert "generate_exercise" in names
    assert "save_progress" in names
    assert "analyze_level" in names
