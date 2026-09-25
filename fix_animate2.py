with open('frontend/src/components/Tree3DEngine.js', 'r') as f:
    content = f.read()

old_animate = """function animate() {
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
}"""

new_animate = """function animate() {
  window._treeReqId = requestAnimationFrame(animate);
  const dt = clock.getDelta();
  clockT += dt;
  
  if (typeof tickSky === 'function') tickSky(dt);
  if (typeof tickCam === 'function') tickCam(dt);
  if (typeof tickBurst === 'function') tickBurst(dt);
  if (typeof tickHover === 'function') tickHover();
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}"""

content = content.replace(old_animate, new_animate)

with open('frontend/src/components/Tree3DEngine.js', 'w') as f:
    f.write(content)
