/**
 * Fallback logic for devices without motion sensors
 */
function initFallbackLogic() {
    const buttons = document.querySelectorAll('#fallback-ui button');
    
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const activity = e.target.getAttribute('data-activity');
            const busy = e.target.getAttribute('data-busy') === 'true';
            
            if (window.updateGlobalState) {
                window.updateGlobalState(activity, busy);
            }
        });
    });
}

window.initFallbackLogic = initFallbackLogic;
