import os
import sys
import time
from playwright.sync_api import sync_playwright

# Configuration
DASHBOARD_URL = "http://localhost:3005/dashboard/index.html"
OUTPUT_DIR = "/home/jules/verification/videos"
SCREENSHOT_DIR = "/home/jules/verification/screenshots"

def record_investor_walkthrough(page):
    print(f"🎬 Starting investor walkthrough recording at {DASHBOARD_URL}")

    # 1. Landing & Risk Terminal Overview
    page.goto(DASHBOARD_URL)

    # Enable Demo Mode for visual consistency if real backend is not fully loaded
    page.evaluate("localStorage.setItem('DEMO_MODE', 'true')")
    page.evaluate("localStorage.setItem('USER_ADDRESS', '0xDEMO_INVESTOR_READY')")
    page.reload()

    page.wait_for_timeout(2000) # Wait for animations

    # Highlight Metrics
    page.evaluate("document.querySelector('#metric-pnl').style.border = '2px solid #00f2ff'")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_risk_terminal.png")

    # 2. Session Report / PnL Modal
    print("📊 Opening Session Report...")
    page.click("#session-report-btn")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_session_report.png")
    page.click("#close-pnl-modal")
    page.wait_for_timeout(500)

    # 3. Technical Audit (The "Glass Box")
    print("🔍 Inspecting Technical Audit...")
    page.click("#tab-audit")
    page.wait_for_timeout(1000)
    # Scroll through audit logs to show signatures
    page.evaluate("document.querySelector('#audit-feed').scrollTop = 100")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/03_audit_trail.png")

    # 4. Agent Operations (The Guardrails)
    print("🛡️ Demonstrating Guardrail controls...")
    page.click("#tab-operations")
    page.wait_for_timeout(1000)
    # Highlight a circuit breaker
    page.evaluate("document.querySelector('input[placeholder=\"0.5\"]').style.backgroundColor = 'rgba(0, 242, 255, 0.1)'")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/04_guardrails.png")

    # 5. HITL (Human-in-the-Loop)
    print("👥 Checking HITL queue...")
    page.click("#tab-hitl")
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/05_hitl_queue.png")

    # Final State: Back to Dashboard
    page.click("#tab-terminal")
    page.wait_for_timeout(2000)
    print("✅ Walkthrough complete.")

if __name__ == "__main__":
    # Ensure directories exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(SCREENSHOT_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # record_video_size can be adjusted for 1080p if needed
        context = browser.new_context(
            viewport={'width': 1280, 'height': 720},
            record_video_dir=OUTPUT_DIR,
            record_video_size={'width': 1280, 'height': 720}
        )
        page = context.new_page()

        try:
            record_investor_walkthrough(page)
        except Exception as e:
            print(f"❌ Error during recording: {e}")
        finally:
            context.close()
            browser.close()

            # Find the recorded video file
            videos = os.listdir(OUTPUT_DIR)
            if videos:
                print(f"🎬 Video saved to: {os.path.join(OUTPUT_DIR, videos[0])}")
            else:
                print("⚠️ No video recorded.")
