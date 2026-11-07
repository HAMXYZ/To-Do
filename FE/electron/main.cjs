const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  Notification,
  ipcMain,
  session,
  nativeImage,
} = require("electron")
const path = require("path")
const fs = require("fs")
const http = require("http")
const { spawn } = require("child_process")

// Đặt AppUserModelId cho Windows ngay từ đầu để Taskbar luôn hiển thị đúng icon và tên
if (process.platform === "win32") {
  app.setAppUserModelId("com.focusflow.ai")
}

let mainWindow = null
let tray = null
let isQuitting = false
let backendProcess = null

// Tự động kiểm tra và khởi động Backend nếu chưa chạy
async function ensureBackendRunning() {
  const isAlive = await pingServer("http://localhost:8000/health")
  if (isAlive) {
    console.log("[Electron] Backend đã sẵn sàng tại http://localhost:8000")
    return
  }

  const bePath = path.resolve(__dirname, "../../BE")
  const beExe = path.join(process.resourcesPath || "", "backend", "focusflow-backend.exe")

  if (fs.existsSync(beExe)) {
    console.log("[Electron] Khởi động backend exe đóng gói:", beExe)
    backendProcess = spawn(beExe, [], { stdio: "ignore", windowsHide: true })
  } else if (fs.existsSync(bePath)) {
    console.log("[Electron] Khởi động backend Python:", bePath)
    backendProcess = spawn("python", ["-m", "uvicorn", "src.main:app", "--port", "8000"], {
      cwd: bePath,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, PYTHONPATH: bePath },
    })
  }

  if (backendProcess) {
    backendProcess.on("error", (err) => {
      console.warn("[Electron] Cảnh báo khởi động backend:", err.message)
    })
  }

  // Chờ tối đa 4 giây để backend sẵn sàng
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 500))
    if (await pingServer("http://localhost:8000/health")) {
      console.log("[Electron] Kết nối backend thành công!")
      break
    }
  }
}

// Đảm bảo chỉ chạy 1 instance ứng dụng
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// Kiểm tra xem một URL có đang phản hồi không
function pingServer(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url)
      const req = http.get(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: "/",
          timeout: 800,
        },
        (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 400)
        },
      )
      req.on("error", () => resolve(false))
      req.on("timeout", () => {
        req.destroy()
        resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
}

async function loadApp(win) {
  const distIndex = path.join(__dirname, "../dist/index.html")

  // Danh sách các cổng dev server Vite có thể chạy (8443 hoặc 5173)
  const candidateUrls = [
    process.env.VITE_DEV_SERVER_URL,
    "http://localhost:8443",
    "http://localhost:5173",
  ].filter(Boolean)

  let activeDevUrl = null
  for (const url of candidateUrls) {
    const alive = await pingServer(url)
    if (alive) {
      activeDevUrl = url
      break
    }
  }

  if (activeDevUrl) {
    console.log(`[Electron] Kết nối tới dev server: ${activeDevUrl}`)
    win.loadURL(activeDevUrl)
  } else if (fs.existsSync(distIndex)) {
    console.log(`[Electron] Tải bản build tĩnh: ${distIndex}`)
    win.loadFile(distIndex)
  } else {
    // Nếu cả dev server và file build đều không có
    console.warn("[Electron] Không tìm thấy dev server hoặc dist/index.html")
    win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>FocusFlow - Đang khởi động</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
            .card { background: white; padding: 36px; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.06); max-width: 480px; text-align: center; border: 1px solid #e2e8f0; }
            h2 { color: #0f172a; margin-top: 0; font-size: 20px; }
            p { color: #64748b; font-size: 14px; line-height: 1.6; }
            .cmd { background: #f1f5f9; padding: 12px; border-radius: 10px; font-family: monospace; font-size: 13px; text-align: left; margin: 18px 0; color: #0f172a; }
            button { background: #22c55e; color: white; border: none; padding: 10px 22px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 13px; transition: background 0.2s; }
            button:hover { background: #16a34a; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚡ Chưa khởi chạy giao diện FocusFlow</h2>
            <p>Ứng dụng Desktop cần máy chủ giao diện Vite hoặc bản build tĩnh trước khi mở:</p>
            <div class="cmd">
              <b>Cách 1 (Khuyên dùng):</b><br/>
              Mở terminal tại thư mục <code>FE</code> và chạy:<br/>
              <code>npm run build</code><br/><br/>
              <b>Cách 2:</b><br/>
              Chạy song song dev server:<br/>
              <code>npm run dev</code>
            </div>
            <button onclick="location.reload()">🔄 Tải lại trang (Reload)</button>
          </div>
        </body>
      </html>
    `)}`,
    )
  }
}

function createWindow() {
  // Tắt thanh menu File, Edit, View, Window... của Electron
  Menu.setApplicationMenu(null)

  const iconIco = path.join(__dirname, "icon.ico")
  const iconPng = path.join(__dirname, "icon.png")
  const appIcon = fs.existsSync(iconIco)
    ? nativeImage.createFromPath(iconIco)
    : nativeImage.createFromPath(iconPng)

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 380,
    minHeight: 520,
    title: "FocusFlow AI",
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Đảm bảo icon hiển thị chuẩn trên thanh Taskbar của Windows
  if (appIcon && !appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon)
  }

  // Cấp quyền Microphone / Media cho ứng dụng Desktop (US-33)
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback) => {
        if (permission === "media" || permission === "microphone") {
          return callback(true)
        }
        callback(true)
      },
    )
  }

  // Tải nội dung
  void loadApp(mainWindow)

  // Tự động fallback về dist/index.html nếu tải URL thất bại
  mainWindow.webContents.on(
    "did-fail-load",
    (_, errorCode, errorDescription, validatedURL) => {
      console.warn(
        `[Electron] Tải URL thất bại (${errorCode}: ${errorDescription}): ${validatedURL}`,
      )
      const distIndex = path.join(__dirname, "../dist/index.html")
      if (fs.existsSync(distIndex) && !validatedURL.startsWith("file:")) {
        mainWindow.loadFile(distIndex)
      }
    },
  )

  // Phím tắt F12 để bật DevTools khi cần kiểm tra log
  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F12" && input.type === "keyDown") {
      mainWindow.webContents.toggleDevTools()
      event.preventDefault()
    }
  })

  // Ẩn xuống khay hệ thống (System Tray) khi người dùng đóng cửa sổ (AC1, QT-09)
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      if (Notification.isSupported()) {
        new Notification({
          title: "FocusFlow AI",
          body: "Ứng dụng đang chạy ở khay hệ thống để tiếp tục thông báo nhắc việc.",
          silent: true,
        }).show()
      }
    }
  })
}

function createTray() {
  try {
    const iconIco = path.join(__dirname, "icon.ico")
    const iconPng = path.join(__dirname, "icon.png")
    const rawIcon = fs.existsSync(iconIco)
      ? nativeImage.createFromPath(iconIco)
      : nativeImage.createFromPath(iconPng)
    const trayIcon = rawIcon.resize({ width: 16, height: 16 })
    tray = new Tray(trayIcon)
  } catch {
    return
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Mở FocusFlow AI",
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      },
    },
    {
      label: "Mở tuần hiện tại",
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send("navigate:current-week")
        }
      },
    },
    { type: "separator" },
    {
      label: "Thoát hẳn",
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setToolTip("FocusFlow AI - Ứng dụng quản lý công việc và nhắc nhở")
  tray.setContextMenu(contextMenu)

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(async () => {
  // App User Model ID cho Windows Native Notifications & Taskbar hiển thị icon và tên chuẩn
  if (process.platform === "win32") {
    app.setAppUserModelId("com.focusflow.ai")
  }

  // Khởi động backend ngầm nếu chưa chạy
  await ensureBackendRunning()

  createWindow()
  createTray()

  // IPC nhận yêu cầu hiển thị Native Windows Notification từ Renderer
  ipcMain.on("app:notification", (_, payload) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: payload.title,
        body: payload.body,
        silent: payload.sound === false,
      })

      // Click vào thông báo Windows: mở ứng dụng và chuyển tới tuần hiện tại (AC1, QT-09)
      notification.on("click", () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
          mainWindow.webContents.send("navigate:current-week")
        }
      })

      notification.show()
    }
  })

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else if (mainWindow) {
      mainWindow.show()
    }
  })
})

app.on("before-quit", () => {
  isQuitting = true
  if (backendProcess) {
    try {
      backendProcess.kill()
    } catch {}
  }
})
