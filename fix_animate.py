with open('frontend/src/components/Tree3DEngine.js', 'r') as f:
    content = f.read()

# I will replace my dummy animate() loop with a better one
old_animate = """function animate() {
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
}"""

new_animate = """
const clock = new THREE.Clock();
let clockT = 0;

function animate() {
  window._treeReqId = requestAnimationFrame(animate);
  const dt = clock.getDelta();
  clockT += dt;
  
  if (typeof tickCam === 'function') {
    tickCam(dt);
  }
  
  // Custom logic for the 3D trees
  if (typeof treeGroup !== 'undefined' && treeGroup) {
    // If they have their own rotation in tickCam, we don't need to manually rotate treeGroup here.
    // The original script did camera orbiting via tickCam
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}
"""

content = content.replace(old_animate, new_animate)

# Make sure we call applyCam once before animating
content = content.replace("animate();", "if(typeof applyCam==='function') applyCam();\nanimate();")

with open('frontend/src/components/Tree3DEngine.js', 'w') as f:
    f.write(content)
