with open('frontend/src/components/Tree3DEngine.js', 'r') as f:
    content = f.read()

idx = content.find("/* ---------- UI render ---------- */")

if idx != -1:
    animate_logic = """
function animate() {
  window._treeReqId = requestAnimationFrame(animate);
  if (typeof treeGroup !== 'undefined' && treeGroup) {
    treeGroup.rotation.y += 0.001; // gentle rotation
  }
  if (typeof envGroup !== 'undefined' && envGroup) {
    envGroup.rotation.y += 0.001; // matching environment rotation
  }
  // Let's add slight sway to leaves if we want
  const t = performance.now() * 0.001;
  if (typeof leafMesh !== 'undefined' && leafMesh) {
    // If you had custom swaying logic, it goes here
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

// Kick off initial rendering and environment setup if not yet done
buildEnv();
if(typeof buildTree==='function') buildTree();
animate();

"""
    content = content[:idx] + animate_logic + content[idx:]
    with open('frontend/src/components/Tree3DEngine.js', 'w') as f:
        f.write(content)
