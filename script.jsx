class TaskManager {
  constructor() {
    this.tasks = JSON.parse(localStorage.getItem("tasks")) || []
    this.currentFilter = "all"
    this.draggedElement = null
    this.init()
  }

  init() {
    this.bindEvents()
    this.loadTheme()
    this.render()
    this.updateStats()
    this.checkDueDates()

    // Check due dates every minute
    setInterval(() => this.checkDueDates(), 60000)
  }

  bindEvents() {
    // Add task
    document.getElementById("addTaskBtn").addEventListener("click", () => this.addTask())
    document.getElementById("taskInput").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.addTask()
    })

    // Theme toggle
    document.getElementById("themeToggle").addEventListener("click", () => this.toggleTheme())

    // Filter buttons
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.setFilter(e.target.dataset.filter))
    })

    // Task list for event delegation
    document.getElementById("taskList").addEventListener("click", (e) => this.handleTaskClick(e))
    document.getElementById("taskList").addEventListener("change", (e) => this.handleTaskChange(e))

    // Drag and drop
    document.getElementById("taskList").addEventListener("dragstart", (e) => this.handleDragStart(e))
    document.getElementById("taskList").addEventListener("dragover", (e) => this.handleDragOver(e))
    document.getElementById("taskList").addEventListener("drop", (e) => this.handleDrop(e))
  }

  addTask() {
    const taskInput = document.getElementById("taskInput")
    const dueDateInput = document.getElementById("dueDateInput")
    const text = taskInput.value.trim()

    if (!text) return

    const task = {
      id: Date.now(),
      text: text,
      completed: false,
      dueDate: dueDateInput.value || null,
      createdAt: new Date().toISOString(),
    }

    this.tasks.push(task)
    this.saveTasks()
    this.render()
    this.updateStats()

    taskInput.value = ""
    dueDateInput.value = ""

    // Show notification for due date
    if (task.dueDate) {
      this.scheduleNotification(task)
    }
  }

  toggleTask(id) {
    const task = this.tasks.find((t) => t.id === id)
    if (task) {
      task.completed = !task.completed
      this.saveTasks()
      this.render()
      this.updateStats()
    }
  }

  editTask(id) {
    const taskElement = document.querySelector(`[data-id="${id}"]`)
    const taskContent = taskElement.querySelector(".task-content")
    const taskText = taskElement.querySelector(".task-text")
    const taskActions = taskElement.querySelector(".task-actions")

    const currentText = taskText.textContent

    taskContent.innerHTML = `
            <input type="text" class="task-edit-input" value="${currentText}">
        `

    taskActions.innerHTML = `
            <button class="task-btn save-btn">💾</button>
            <button class="task-btn cancel-btn">❌</button>
        `

    const input = taskContent.querySelector(".task-edit-input")
    input.focus()
    input.select()
  }

  saveEdit(id) {
    const taskElement = document.querySelector(`[data-id="${id}"]`)
    const input = taskElement.querySelector(".task-edit-input")
    const newText = input.value.trim()

    if (newText) {
      const task = this.tasks.find((t) => t.id === id)
      task.text = newText
      this.saveTasks()
    }

    this.render()
  }

  cancelEdit() {
    this.render()
  }

  deleteTask(id) {
    const taskElement = document.querySelector(`[data-id="${id}"]`)
    taskElement.classList.add("removing")

    setTimeout(() => {
      this.tasks = this.tasks.filter((t) => t.id !== id)
      this.saveTasks()
      this.render()
      this.updateStats()
    }, 300)
  }

  setFilter(filter) {
    this.currentFilter = filter

    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    document.querySelector(`[data-filter="${filter}"]`).classList.add("active")

    this.render()
  }

  getFilteredTasks() {
    switch (this.currentFilter) {
      case "active":
        return this.tasks.filter((task) => !task.completed)
      case "completed":
        return this.tasks.filter((task) => task.completed)
      default:
        return this.tasks
    }
  }

  render() {
    const taskList = document.getElementById("taskList")
    const filteredTasks = this.getFilteredTasks()

    taskList.innerHTML = filteredTasks.map((task) => this.createTaskHTML(task)).join("")
  }

  createTaskHTML(task) {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null
    const now = new Date()
    const isOverdue = dueDate && dueDate < now && !task.completed
    const isDueSoon = dueDate && dueDate > now && dueDate - now < 24 * 60 * 60 * 1000 && !task.completed

    let dueDateClass = ""
    if (isOverdue) dueDateClass = "overdue"
    else if (isDueSoon) dueDateClass = "due-soon"

    const dueDateText = dueDate ? `<div class="task-due-date">Due: ${dueDate.toLocaleDateString()}</div>` : ""

    return `
            <div class="task-item ${task.completed ? "completed" : ""} ${dueDateClass}" 
                 data-id="${task.id}" draggable="true">
                <input type="checkbox" class="task-checkbox" ${task.completed ? "checked" : ""}>
                <div class="task-content">
                    <div class="task-text">${task.text}</div>
                    ${dueDateText}
                </div>
                <div class="task-actions">
                    <button class="task-btn edit-btn">✏️</button>
                    <button class="task-btn delete-btn">🗑️</button>
                </div>
            </div>
        `
  }

  handleTaskClick(e) {
    const taskItem = e.target.closest(".task-item")
    if (!taskItem) return

    const id = Number.parseInt(taskItem.dataset.id)

    if (e.target.classList.contains("edit-btn")) {
      this.editTask(id)
    } else if (e.target.classList.contains("delete-btn")) {
      this.deleteTask(id)
    } else if (e.target.classList.contains("save-btn")) {
      this.saveEdit(id)
    } else if (e.target.classList.contains("cancel-btn")) {
      this.cancelEdit()
    }
  }

  handleTaskChange(e) {
    if (e.target.classList.contains("task-checkbox")) {
      const taskItem = e.target.closest(".task-item")
      const id = Number.parseInt(taskItem.dataset.id)
      this.toggleTask(id)
    }
  }

  handleDragStart(e) {
    if (e.target.classList.contains("task-item")) {
      this.draggedElement = e.target
      e.target.classList.add("dragging")
    }
  }

  handleDragOver(e) {
    e.preventDefault()
  }

  handleDrop(e) {
    e.preventDefault()

    if (!this.draggedElement) return

    const dropTarget = e.target.closest(".task-item")
    if (dropTarget && dropTarget !== this.draggedElement) {
      const draggedId = Number.parseInt(this.draggedElement.dataset.id)
      const targetId = Number.parseInt(dropTarget.dataset.id)

      this.reorderTasks(draggedId, targetId)
    }

    this.draggedElement.classList.remove("dragging")
    this.draggedElement = null
  }

  reorderTasks(draggedId, targetId) {
    const draggedIndex = this.tasks.findIndex((t) => t.id === draggedId)
    const targetIndex = this.tasks.findIndex((t) => t.id === targetId)

    const [draggedTask] = this.tasks.splice(draggedIndex, 1)
    this.tasks.splice(targetIndex, 0, draggedTask)

    this.saveTasks()
    this.render()
  }

  updateStats() {
    const totalTasks = this.tasks.length
    const completedTasks = this.tasks.filter((task) => task.completed).length
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    document.getElementById("progressFill").style.width = `${percentage}%`
    document.getElementById("progressText").textContent = `${percentage}% completed`
    document.getElementById("taskCount").textContent = `${totalTasks} task${totalTasks !== 1 ? "s" : ""}`
  }

  checkDueDates() {
    const now = new Date()
    this.tasks.forEach((task) => {
      if (task.dueDate && !task.completed && !task.notified) {
        const dueDate = new Date(task.dueDate)
        if (dueDate <= now) {
          this.showNotification(`Task "${task.text}" is overdue!`)
          task.notified = true
        }
      }
    })
    this.saveTasks()
    this.render()
  }

  scheduleNotification(task) {
    if (!task.dueDate) return

    const dueDate = new Date(task.dueDate)
    const now = new Date()
    const timeUntilDue = dueDate - now

    if (timeUntilDue > 0 && timeUntilDue <= 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        if (!task.completed) {
          this.showNotification(`Task "${task.text}" is due today!`)
        }
      }, timeUntilDue)
    }
  }

  showNotification(message) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Task Manager", { body: message })
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification("Task Manager", { body: message })
        }
      })
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme")
    const newTheme = currentTheme === "dark" ? "light" : "dark"

    document.documentElement.setAttribute("data-theme", newTheme)
    localStorage.setItem("theme", newTheme)

    const themeIcon = document.querySelector(".theme-icon")
    themeIcon.textContent = newTheme === "dark" ? "☀️" : "🌙"
  }

  loadTheme() {
    const savedTheme = localStorage.getItem("theme") || "light"
    document.documentElement.setAttribute("data-theme", savedTheme)

    const themeIcon = document.querySelector(".theme-icon")
    themeIcon.textContent = savedTheme === "dark" ? "☀️" : "🌙"
  }

  saveTasks() {
    localStorage.setItem("tasks", JSON.stringify(this.tasks))
  }
}

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  new TaskManager()
})
