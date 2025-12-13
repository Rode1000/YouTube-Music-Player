function injectVideoAdSkipper(webContents, opts) {
  const enabled = !!(opts && opts.enabled);
  if (!enabled) return;
  const speed = (opts && opts.speed) || 2;
  const interval = (opts && opts.interval) || 200;
  webContents.executeJavaScript(
    `(function(){console.log('Video ad skipper initialized (Speed: ${speed}x, Interval: ${interval}ms)');
    function skipVideoAd(){try{const skipSelectors=['.ytp-ad-skip-button','.ytp-ad-skip-button-modern','.ytp-skip-ad-button','.ytp-ad-skip-button-container button','button.ytp-ad-skip-button','[class*="skip"][class*="button"]'];
    for(const selector of skipSelectors){const skipButton=document.querySelector(selector);if(skipButton){const isClickable=!skipButton.disabled&&skipButton.offsetParent!==null&&!skipButton.hasAttribute('disabled');
    if(isClickable){skipButton.click();console.log('lol - Skipped video ad');return true;}}}const video=document.querySelector('video');
    if(video){const player=document.querySelector('.html5-video-player');if(player&&(player.classList.contains('ad-showing')||player.classList.contains('ad-interrupting'))){if(video.duration&&video.duration>0&&!isNaN(video.duration)){video.currentTime=Math.max(0,video.duration-0.1);
    video.playbackRate=${speed};console.log('lol - Fast-forwarding through ad at (Speed=${speed}x)');return true;}}}}catch(e){}return false}setInterval(skipVideoAd,${interval});document.addEventListener('DOMContentLoaded',skipVideoAd);
    window.addEventListener('load',skipVideoAd);const observer=new MutationObserver(skipVideoAd);
    observer.observe(document.body,{childList:true,subtree:true});})();`);
}

module.exports = { injectVideoAdSkipper };