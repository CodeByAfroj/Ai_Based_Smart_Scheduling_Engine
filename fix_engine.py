with open('frontend/src/components/TaskTreeScript.js', 'r') as f:
    js = f.read()

# Replace first IIFE
js = js.replace("(function(){\n'use strict';", "export function initTree3D(containerElement, tasksList) {\n'use strict';\nlet tasks = tasksList || [];\n", 1)

# At the very end of the file, we replace the last })();
last_iife = js.rfind("})();")
if last_iife != -1:
    js = js[:last_iife] + """
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
""" + js[last_iife+5:]

# Fix container logic
js = js.replace("const container=$('#scene');", "const container=containerElement;")

# Fix state logic to seed from our tasksList
js = js.replace("let state=null;", "let state = { tasks: tasksList || [], tab:'todo', sky:'auto', sound:false, rot:true };")
js = js.replace("try{state=JSON.parse(localStorage.getItem('tasktree_v1'))||null}catch(e){state=null}", "")
js = js.replace("if(!state||!Array.isArray(state.tasks))state={tasks:[],tab:'todo',sky:'auto',sound:true,quote:0,rot:true};", "")
js = js.replace("if(state.rot===undefined)state.rot=true;", "")

# Fix requestAnimationFrame so we can cancel it
js = js.replace("requestAnimationFrame(render)", "window._treeReqId = requestAnimationFrame(render)")

# Add THREE import
js = "import * as THREE from 'three';\n" + js

with open('frontend/src/components/GrowTree3DEngine.js', 'w') as f:
    f.write(js)
