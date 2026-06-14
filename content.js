let sidebarFrame = null;
let sidebarVisible = false;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "TOGGLE_SIDEBAR") {
    toggleSidebar();
    sendResponse({ visible: sidebarVisible });
  }
  if (msg.type === "OPEN_POPUP_WITH_IMAGE") {
    chrome.runtime.sendMessage({ type: "SET_PENDING_IMAGE", imageUrl: msg.imageUrl });
  }
});

function toggleSidebar() {
  if (sidebarVisible && sidebarFrame) {
    sidebarFrame.remove();
    sidebarFrame = null;
    sidebarVisible = false;
    return;
  }

  sidebarFrame = document.createElement("iframe");
  sidebarFrame.src = chrome.runtime.getURL("sidebar.html");
  sidebarFrame.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 300px !important;
    height: 100vh !important;
    border: none !important;
    z-index: 2147483647 !important;
    box-shadow: -4px 0 24px rgba(0,0,0,0.15) !important;
  `;
  document.body.appendChild(sidebarFrame);
  sidebarVisible = true;
}
