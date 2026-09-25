with open('frontend/src/components/GrowTree3DEngine.js', 'r') as f:
    content = f.read()

# find the last "return function cleanup()" and everything after
idx = content.find("return function cleanup()")
if idx != -1:
    content = content[:idx] + """
  return {
    updateTasks: (newTasks) => {
      state.tasks = newTasks;
      renderTasks();
      renderStats();
      buildTree();
      buildEnv();
    },
    cleanup: () => {
      cancelAnimationFrame(window._treeReqId);
      if(renderer) {
        renderer.dispose();
        if(containerElement.contains(renderer.domElement)) containerElement.removeChild(renderer.domElement);
      }
    }
  };
}
"""
    with open('frontend/src/components/GrowTree3DEngine.js', 'w') as f:
        f.write(content)
