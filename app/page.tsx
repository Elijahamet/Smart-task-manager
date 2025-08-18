"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"

interface Subtask {
  id: number
  text: string
  completed: boolean
}

interface Task {
  id: number
  text: string
  completed: boolean
  dueDate: string | null
  createdAt: string
  notified?: boolean
  category: string
  priority: "low" | "medium" | "high"
  subtasks: Subtask[]
  notes: string
  timeSpent: number // in minutes
  isRecurring: boolean
  recurringType?: "daily" | "weekly" | "monthly"
  tags: string[]
}

interface TaskTemplate {
  id: number
  name: string
  text: string
  category: string
  priority: "low" | "medium" | "high"
  subtasks: string[]
  notes: string
}

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentFilter, setCurrentFilter] = useState<"all" | "active" | "completed">("all")
  const [taskInput, setTaskInput] = useState("")
  const [dueDateInput, setDueDateInput] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [draggedTask, setDraggedTask] = useState<number | null>(null)
  const draggedElement = useRef<HTMLDivElement | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [selectedPriority, setSelectedPriority] = useState("all")
  const [taskCategory, setTaskCategory] = useState("personal")
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium")
  const [taskNotes, setTaskNotes] = useState("")
  const [taskTags, setTaskTags] = useState("")
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurringType, setRecurringType] = useState<"daily" | "weekly" | "monthly">("weekly")
  const [showAdvancedForm, setShowAdvancedForm] = useState(false)
  const [activeTimers, setActiveTimers] = useState<{ [key: number]: number }>({})
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [showTemplates, setShowTemplates] = useState(false)
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set())

  const checkDueDates = useCallback(() => {
    const now = new Date()
    setTasks((prev) =>
      prev.map((task) => {
        if (task.dueDate && !task.completed && !task.notified) {
          const dueDate = new Date(task.dueDate)
          if (dueDate <= now) {
            showNotification(`Task "${task.text}" is overdue!`)
            return { ...task, notified: true }
          }
        }
        return task
      }),
    )
  }, [])

  // Load tasks and theme on mount
  useEffect(() => {
    const savedTasks = localStorage.getItem("tasks")
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks))
    }

    const savedTemplates = localStorage.getItem("taskTemplates")
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates))
    } else {
      // Default templates
      const defaultTemplates: TaskTemplate[] = [
        {
          id: 1,
          name: "Daily Standup",
          text: "Attend daily standup meeting",
          category: "work",
          priority: "high",
          subtasks: ["Prepare updates", "Review blockers", "Plan next tasks"],
          notes: "Remember to mention yesterday's progress",
        },
        {
          id: 2,
          name: "Weekly Review",
          text: "Conduct weekly review",
          category: "personal",
          priority: "medium",
          subtasks: ["Review goals", "Plan next week", "Update journal"],
          notes: "Reflect on achievements and areas for improvement",
        },
      ]
      setTemplates(defaultTemplates)
      localStorage.setItem("taskTemplates", JSON.stringify(defaultTemplates))
    }

    const savedTheme = localStorage.getItem("theme")
    const isDark = savedTheme === "dark"
    setIsDarkMode(isDark)
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light")

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    // Initial check
    checkDueDates()

    // Check due dates every minute
    const interval = setInterval(checkDueDates, 60000)
    return () => clearInterval(interval)
  }, [checkDueDates])

  useEffect(() => {
    if (tasks.length > 0) {
      localStorage.setItem("tasks", JSON.stringify(tasks))
    }
  }, [tasks])

  const addTask = () => {
    const text = taskInput.trim()
    if (!text) return

    const task: Task = {
      id: Date.now(),
      text,
      completed: false,
      dueDate: dueDateInput || null,
      createdAt: new Date().toISOString(),
      category: taskCategory,
      priority: taskPriority,
      subtasks: [],
      notes: taskNotes,
      timeSpent: 0,
      isRecurring,
      recurringType: isRecurring ? recurringType : undefined,
      tags: taskTags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag),
    }

    setTasks((prev) => [...(prev || []), task])
    setTaskInput("")
    setDueDateInput("")
    setTaskNotes("")
    setTaskTags("")
    setIsRecurring(false)
    setShowAdvancedForm(false)

    if (task.dueDate) {
      scheduleNotification(task)
    }
  }

  const createFromTemplate = (template: TaskTemplate) => {
    const task: Task = {
      id: Date.now(),
      text: template.text,
      completed: false,
      dueDate: null,
      createdAt: new Date().toISOString(),
      category: template.category,
      priority: template.priority,
      subtasks: template.subtasks.map((text, index) => ({
        id: Date.now() + index,
        text,
        completed: false,
      })),
      notes: template.notes,
      timeSpent: 0,
      isRecurring: false,
      tags: [],
    }

    setTasks((prev) => [...(prev || []), task])
    setShowTemplates(false)
  }

  const toggleTask = (id: number) => {
    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)))
  }

  const addSubtask = (taskId: number, subtaskText: string) => {
    if (!subtaskText.trim()) return

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: [
                ...task.subtasks,
                {
                  id: Date.now(),
                  text: subtaskText.trim(),
                  completed: false,
                },
              ],
            }
          : task,
      ),
    )
  }

  const toggleSubtask = (taskId: number, subtaskId: number) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              subtasks: task.subtasks.map((subtask) =>
                subtask.id === subtaskId ? { ...subtask, completed: !subtask.completed } : subtask,
              ),
            }
          : task,
      ),
    )
  }

  const deleteSubtask = (taskId: number, subtaskId: number) => {
    setTasks((prev) =>
      (prev || []).map((task) =>
        task.id === taskId
          ? { ...task, subtasks: (task.subtasks || []).filter((subtask) => subtask.id !== subtaskId) }
          : task,
      ),
    )
  }

  const startTimer = (taskId: number) => {
    const startTime = Date.now()
    setActiveTimers((prev) => ({ ...prev, [taskId]: startTime }))
  }

  const stopTimer = (taskId: number) => {
    const startTime = activeTimers[taskId]
    if (startTime) {
      const timeSpent = Math.round((Date.now() - startTime) / 60000) // Convert to minutes
      setTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, timeSpent: task.timeSpent + timeSpent } : task)),
      )
      setActiveTimers((prev) => {
        const newTimers = { ...prev }
        delete newTimers[taskId]
        return newTimers
      })
    }
  }

  const exportTasks = () => {
    const dataStr = JSON.stringify({ tasks, templates }, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = "tasks-backup.json"
    link.click()
    URL.revokeObjectURL(url)
  }

  const importTasks = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          if (data.tasks) setTasks(data.tasks)
          if (data.templates) setTemplates(data.templates)
        } catch (error) {
          alert("Invalid file format")
        }
      }
      reader.readAsText(file)
    }
  }

  const startEdit = (id: number, text: string) => {
    setEditingId(id)
    setEditText(text)
  }

  const saveEdit = (id: number) => {
    if (editText.trim()) {
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, text: editText.trim() } : task)))
    }
    setEditingId(null)
    setEditText("")
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditText("")
  }

  const deleteTask = (id: number) => {
    setTasks((prev) => (prev || []).filter((task) => task.id !== id))
  }

  const toggleTheme = () => {
    const newTheme = !isDarkMode
    setIsDarkMode(newTheme)
    document.documentElement.setAttribute("data-theme", newTheme ? "dark" : "light")
    localStorage.setItem("theme", newTheme ? "dark" : "light")
  }

  const scheduleNotification = (task: Task) => {
    if (!task.dueDate) return

    const dueDate = new Date(task.dueDate)
    const now = new Date()
    const timeUntilDue = dueDate.getTime() - now.getTime()

    if (timeUntilDue > 0 && timeUntilDue <= 24 * 60 * 60 * 1000) {
      setTimeout(() => {
        if (!task.completed) {
          showNotification(`Task "${task.text}" is due today!`)
        }
      }, timeUntilDue)
    }
  }

  const showNotification = (message: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Task Manager", { body: message })
    }
  }

  const handleDragStart = (e: React.DragEvent, taskId: number) => {
    setDraggedTask(taskId)
    if (e.currentTarget instanceof HTMLElement) {
      draggedElement.current = e.currentTarget as HTMLDivElement
      e.currentTarget.classList.add("dragging")
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault()

    if (draggedTask && draggedTask !== targetId) {
      const draggedIndex = tasks.findIndex((t) => t.id === draggedTask)
      const targetIndex = tasks.findIndex((t) => t.id === targetId)

      const newTasks = [...tasks]
      const [draggedTaskObj] = newTasks.splice(draggedIndex, 1)
      newTasks.splice(targetIndex, 0, draggedTaskObj)

      setTasks(newTasks)
    }

    if (draggedElement.current) {
      draggedElement.current.classList.remove("dragging")
    }
    setDraggedTask(null)
  }

  const getFilteredTasks = () => {
    let filtered = [...(tasks || [])]

    // Filter by completion status
    switch (currentFilter) {
      case "active":
        filtered = filtered.filter((task) => !task.completed)
        break
      case "completed":
        filtered = filtered.filter((task) => task.completed)
        break
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (task) =>
          task.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.notes || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (task.tags || []).some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    }

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((task) => task.category === selectedCategory)
    }

    // Filter by priority
    if (selectedPriority !== "all") {
      filtered = filtered.filter((task) => task.priority === selectedPriority)
    }

    return filtered
  }

  const getTaskStatus = (task: Task) => {
    if (!task.dueDate || task.completed) return ""

    const dueDate = new Date(task.dueDate)
    const now = new Date()
    const isOverdue = dueDate < now
    const isDueSoon = dueDate > now && dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000

    if (isOverdue) return "overdue"
    if (isDueSoon) return "due-soon"
    return ""
  }

  const getCategories = () => {
    const categories = [
      ...new Set((tasks || []).map((task) => task.category).filter((category) => category && category.trim())),
    ]
    return categories
  }

  const getAnalytics = () => {
    const safeTasks = tasks || []
    const totalTasks = safeTasks.length
    const completedTasks = safeTasks.filter((task) => task.completed).length
    const totalTimeSpent = safeTasks.reduce((sum, task) => sum + (task.timeSpent || 0), 0)
    const tasksByCategory = getCategories().map((category) => ({
      category,
      total: safeTasks.filter((task) => task.category === category).length,
      completed: safeTasks.filter((task) => task.category === category && task.completed).length,
    }))

    return { totalTasks, completedTasks, totalTimeSpent, tasksByCategory }
  }

  const totalTasks = tasks.length
  const completedTasks = tasks.filter((task) => task.completed).length
  const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
  const analytics = getAnalytics()

  const filteredTasks = getFilteredTasks()

  return (
    <div className="task-manager-container">
      <style jsx>{`
        .task-manager-container {
          --bg-primary: #ffffff;
          --bg-secondary: #f8f9fa;
          --bg-tertiary: #e9ecef;
          --text-primary: #212529;
          --text-secondary: #6c757d;
          --accent-primary: #007bff;
          --accent-secondary: #28a745;
          --accent-danger: #dc3545;
          --accent-warning: #ffc107;
          --border-color: #dee2e6;
          --shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          --shadow-hover: 0 4px 8px rgba(0, 0, 0, 0.15);
          --border-radius: 8px;
          --transition: all 0.3s ease;
          
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background-color: var(--bg-primary);
          color: var(--text-primary);
          line-height: 1.6;
          transition: var(--transition);
        }

        [data-theme="dark"] .task-manager-container {
          --bg-primary: #1a1a1a;
          --bg-secondary: #2d2d2d;
          --bg-tertiary: #404040;
          --text-primary: #ffffff;
          --text-secondary: #b0b0b0;
          --border-color: #404040;
          --shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          --shadow-hover: 0 4px 8px rgba(0, 0, 0, 0.4);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding: 20px 0;
          border-bottom: 2px solid var(--border-color);
        }

        .app-title {
          font-size: 2rem;
          font-weight: 700;
          color: var(--accent-primary);
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .theme-toggle, .action-btn {
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius);
          padding: 10px 15px;
          cursor: pointer;
          font-size: 1rem;
          transition: var(--transition);
          color: var(--text-primary);
        }

        .theme-toggle:hover, .action-btn:hover {
          background: var(--bg-tertiary);
          transform: scale(1.05);
        }

        .task-input-section {
          margin-bottom: 30px;
          background: var(--bg-secondary);
          padding: 20px;
          border-radius: var(--border-radius);
          border: 2px solid var(--border-color);
        }

        .input-group {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 15px;
        }

        .advanced-form {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid var(--border-color);
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .form-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-secondary);
        }

        .task-input, .due-date-input, .form-select, .form-textarea {
          padding: 12px;
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius);
          font-size: 1rem;
          background: var(--bg-primary);
          color: var(--text-primary);
          transition: var(--transition);
        }

        .task-input {
          flex: 1;
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .task-input:focus, .due-date-input:focus, .form-select:focus, .form-textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
        }

        .add-btn, .template-btn {
          padding: 12px 20px;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: var(--border-radius);
          font-size: 1rem;
          cursor: pointer;
          transition: var(--transition);
        }

        .add-btn:hover, .template-btn:hover {
          background: #0056b3;
          transform: translateY(-2px);
          box-shadow: var(--shadow-hover);
        }

        .template-btn {
          background: var(--accent-secondary);
        }

        .template-btn:hover {
          background: #218838;
        }

        .toggle-advanced {
          background: none;
          border: none;
          color: var(--accent-primary);
          cursor: pointer;
          font-size: 0.9rem;
          text-decoration: underline;
        }

        .search-filters {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
          align-items: end;
        }

        .search-input {
          padding: 12px;
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius);
          font-size: 1rem;
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .filters-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 20px;
        }

        .filter-tabs {
          display: flex;
          gap: 5px;
        }

        .filter-btn {
          padding: 10px 20px;
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: var(--transition);
          color: var(--text-primary);
        }

        .filter-btn:hover {
          background: var(--bg-tertiary);
        }

        .filter-btn.active {
          background: var(--accent-primary);
          color: white;
          border-color: var(--accent-primary);
        }

        .stats {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .progress-container {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .progress-bar {
          width: 150px;
          height: 8px;
          background: var(--bg-tertiary);
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent-secondary);
          transition: width 0.5s ease;
        }

        .progress-text, .task-count {
          font-size: 0.9rem;
          color: var(--text-secondary);
          white-space: nowrap;
        }

        .analytics-panel {
          background: var(--bg-secondary);
          padding: 20px;
          border-radius: var(--border-radius);
          margin-bottom: 20px;
          border: 2px solid var(--border-color);
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .analytics-card {
          background: var(--bg-primary);
          padding: 15px;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
        }

        .analytics-title {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 5px;
        }

        .analytics-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-primary);
        }

        .task-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .task-item {
          background: var(--bg-secondary);
          border: 2px solid var(--border-color);
          border-radius: var(--border-radius);
          transition: var(--transition);
          cursor: grab;
          animation: fadeIn 0.3s ease;
          overflow: hidden;
        }

        .task-header {
          display: flex;
          align-items: center;
          padding: 15px;
        }

        .task-item:hover {
          box-shadow: var(--shadow-hover);
          transform: translateY(-1px);
        }

        .task-item.dragging {
          opacity: 0.5;
          transform: rotate(5deg);
        }

        .task-item.completed {
          opacity: 0.7;
        }

        .task-item.completed .task-text {
          text-decoration: line-through;
          color: var(--text-secondary);
        }

        .task-item.overdue {
          border-color: var(--accent-danger);
          background: rgba(220, 53, 69, 0.1);
        }

        .task-item.due-soon {
          border-color: var(--accent-warning);
          background: rgba(255, 193, 7, 0.1);
        }

        .priority-indicator {
          width: 4px;
          height: 100%;
          position: absolute;
          left: 0;
          top: 0;
        }

        .priority-high { background: var(--accent-danger); }
        .priority-medium { background: var(--accent-warning); }
        .priority-low { background: var(--accent-secondary); }

        .task-checkbox {
          width: 20px;
          height: 20px;
          margin-right: 15px;
          cursor: pointer;
          accent-color: var(--accent-secondary);
        }

        .task-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .task-main-info {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 15px;
        }

        .task-text {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          word-break: break-word;
        }

        .task-meta {
          display: flex;
          gap: 15px;
          align-items: center;
          flex-wrap: wrap;
        }

        .task-category, .task-priority, .task-time {
          font-size: 0.8rem;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: 600;
        }

        .task-category {
          background: var(--accent-primary);
          color: white;
        }

        .task-priority {
          color: white;
        }

        .task-priority.high { background: var(--accent-danger); }
        .task-priority.medium { background: var(--accent-warning); }
        .task-priority.low { background: var(--accent-secondary); }

        .task-time {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .task-due-date {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .task-tags {
          display: flex;
          gap: 5px;
          flex-wrap: wrap;
        }

        .task-tag {
          font-size: 0.7rem;
          background: var(--bg-tertiary);
          color: var(--text-primary);
          padding: 2px 6px;
          border-radius: 8px;
        }

        .task-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .task-btn {
          padding: 6px 10px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
          transition: var(--transition);
        }

        .expand-btn {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }

        .timer-btn {
          background: var(--accent-secondary);
          color: white;
        }

        .timer-btn.active {
          background: var(--accent-danger);
        }

        .edit-btn {
          background: var(--accent-primary);
          color: white;
        }

        .edit-btn:hover {
          background: #0056b3;
        }

        .delete-btn {
          background: var(--accent-danger);
          color: white;
        }

        .delete-btn:hover {
          background: #c82333;
        }

        .save-btn {
          background: var(--accent-secondary);
          color: white;
        }

        .save-btn:hover {
          background: #218838;
        }

        .cancel-btn {
          background: var(--text-secondary);
          color: white;
        }

        .cancel-btn:hover {
          background: #5a6268;
        }

        .task-edit-input {
          flex: 1;
          padding: 10px;
          border: 2px solid var(--accent-primary);
          border-radius: 4px;
          font-size: 1rem;
          background: var(--bg-primary);
          color: var(--text-primary);
        }

        .task-expanded {
          padding: 0 15px 15px;
          border-top: 1px solid var(--border-color);
        }

        .task-notes {
          background: var(--bg-primary);
          padding: 12px;
          border-radius: var(--border-radius);
          border: 1px solid var(--border-color);
          margin-bottom: 15px;
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .subtasks {
          margin-top: 15px;
        }

        .subtasks-title {
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 10px;
          color: var(--text-secondary);
        }

        .subtask-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .subtask-item:last-child {
          border-bottom: none;
        }

        .subtask-checkbox {
          width: 16px;
          height: 16px;
        }

        .subtask-text {
          flex: 1;
          font-size: 0.9rem;
        }

        .subtask-text.completed {
          text-decoration: line-through;
          color: var(--text-secondary);
        }

        .subtask-input {
          display: flex;
          gap: 10px;
          margin-top: 10px;
        }

        .subtask-input input {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          font-size: 0.9rem;
        }

        .subtask-add-btn {
          padding: 8px 12px;
          background: var(--accent-primary);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.8rem;
        }

        .templates-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .templates-content {
          background: var(--bg-primary);
          padding: 30px;
          border-radius: var(--border-radius);
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .templates-title {
          font-size: 1.5rem;
          margin-bottom: 20px;
          color: var(--text-primary);
        }

        .template-item {
          background: var(--bg-secondary);
          padding: 15px;
          border-radius: var(--border-radius);
          margin-bottom: 15px;
          border: 2px solid var(--border-color);
          cursor: pointer;
          transition: var(--transition);
        }

        .template-item:hover {
          border-color: var(--accent-primary);
          transform: translateY(-2px);
        }

        .template-name {
          font-weight: 600;
          margin-bottom: 5px;
        }

        .template-description {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 768px) {
          .task-manager-container {
            padding: 15px;
          }

          .app-title {
            font-size: 1.5rem;
          }

          .input-group {
            flex-direction: column;
          }

          .search-filters {
            grid-template-columns: 1fr;
          }

          .filters-stats {
            flex-direction: column;
            align-items: stretch;
          }

          .stats {
            justify-content: space-between;
          }

          .task-actions {
            flex-direction: column;
          }

          .advanced-form {
            grid-template-columns: 1fr;
          }

          .analytics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <header className="header">
        <h1 className="app-title">🚀 Smart Task Manager Pro</h1>
        <div className="header-actions">
          <input type="file" accept=".json" onChange={importTasks} style={{ display: "none" }} id="import-file" />
          <label htmlFor="import-file" className="action-btn">
            📥 Import
          </label>
          <button onClick={exportTasks} className="action-btn">
            📤 Export
          </button>
          <button className="theme-toggle" onClick={toggleTheme}>
            <span>{isDarkMode ? "☀️" : "🌙"}</span>
          </button>
        </div>
      </header>

      <main>
        <div className="analytics-panel">
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-title">Total Tasks</div>
              <div className="analytics-value">{analytics.totalTasks}</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-title">Completed</div>
              <div className="analytics-value">{analytics.completedTasks}</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-title">Time Spent</div>
              <div className="analytics-value">
                {Math.floor(analytics.totalTimeSpent / 60)}h {analytics.totalTimeSpent % 60}m
              </div>
            </div>
            <div className="analytics-card">
              <div className="analytics-title">Completion Rate</div>
              <div className="analytics-value">{percentage}%</div>
            </div>
          </div>
        </div>

        <div className="task-input-section">
          <div className="input-group">
            <input
              type="text"
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && addTask()}
              placeholder="Add a new task..."
              className="task-input"
            />
            <input
              type="date"
              value={dueDateInput}
              onChange={(e) => setDueDateInput(e.target.value)}
              className="due-date-input"
            />
            <button onClick={addTask} className="add-btn">
              ➕ Add
            </button>
            <button onClick={() => setShowTemplates(true)} className="template-btn">
              📋 Templates
            </button>
          </div>

          <button onClick={() => setShowAdvancedForm(!showAdvancedForm)} className="toggle-advanced">
            {showAdvancedForm ? "Hide" : "Show"} Advanced Options
          </button>

          {showAdvancedForm && (
            <div className="advanced-form">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select value={taskCategory} onChange={(e) => setTaskCategory(e.target.value)} className="form-select">
                  <option value="personal">Personal</option>
                  <option value="work">Work</option>
                  <option value="health">Health</option>
                  <option value="learning">Learning</option>
                  <option value="finance">Finance</option>
                  <option value="social">Social</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as "low" | "medium" | "high")}
                  className="form-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={taskTags}
                  onChange={(e) => setTaskTags(e.target.value)}
                  placeholder="urgent, meeting, review"
                  className="task-input"
                />
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">
                  <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />{" "}
                  Recurring Task
                </label>
                {isRecurring && (
                  <select
                    value={recurringType}
                    onChange={(e) => setRecurringType(e.target.value as "daily" | "weekly" | "monthly")}
                    className="form-select"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label className="form-label">Notes</label>
                <textarea
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="Additional notes or details..."
                  className="form-textarea"
                />
              </div>
            </div>
          )}
        </div>

        <div className="search-filters">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search tasks, notes, or tags..."
            className="search-input"
          />

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="form-select"
          >
            <option value="all">All Categories</option>
            {getCategories().map((category) => (
              <option key={category} value={category}>
                {category && category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="form-select"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>
        </div>

        <div className="filters-stats">
          <div className="filter-tabs">
            {(["all", "active", "completed"] as const).map((filter) => (
              <button
                key={filter}
                className={`filter-btn ${currentFilter === filter ? "active" : ""}`}
                onClick={() => setCurrentFilter(filter)}
              >
                {filter && filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
          <div className="stats">
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${percentage}%` }} />
              </div>
              <span className="progress-text">{percentage}% completed</span>
            </div>
            <div className="task-count">
              {filteredTasks.length} of {totalTasks} task{totalTasks !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        <div className="task-list">
          {filteredTasks.map((task) => {
            const taskStatus = getTaskStatus(task)
            const dueDate = task.dueDate ? new Date(task.dueDate) : null
            const isExpanded = expandedTasks.has(task.id)
            const isTimerActive = activeTimers[task.id]
            const completedSubtasks = (task.subtasks || []).filter((st) => st.completed).length

            return (
              <div
                key={task.id}
                className={`task-item ${task.completed ? "completed" : ""} ${taskStatus}`}
                draggable
                onDragStart={(e) => handleDragStart(e, task.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, task.id)}
                style={{ position: "relative" }}
              >
                <div className={`priority-indicator priority-${task.priority}`} />

                <div className="task-header">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="task-checkbox"
                  />

                  <div className="task-content">
                    <div className="task-main-info">
                      {editingId === task.id ? (
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyPress={(e) => e.key === "Enter" && saveEdit(task.id)}
                          className="task-edit-input"
                          autoFocus
                        />
                      ) : (
                        <div className="task-text">{task.text}</div>
                      )}
                    </div>

                    <div className="task-meta">
                      <span className="task-category">{task.category}</span>
                      <span className={`task-priority ${task.priority}`}>{task.priority.toUpperCase()}</span>
                      {task.timeSpent > 0 && (
                        <span className="task-time">
                          ⏱️ {Math.floor(task.timeSpent / 60)}h {task.timeSpent % 60}m
                        </span>
                      )}
                      {task.subtasks.length > 0 && (
                        <span className="task-time">
                          📋 {completedSubtasks}/{task.subtasks.length}
                        </span>
                      )}
                      {dueDate && <div className="task-due-date">Due: {dueDate.toLocaleDateString()}</div>}
                    </div>

                    {task.tags.length > 0 && (
                      <div className="task-tags">
                        {task.tags.map((tag, index) => (
                          <span key={index} className="task-tag">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="task-actions">
                    {(task.notes || task.subtasks.length > 0) && (
                      <button
                        onClick={() =>
                          setExpandedTasks((prev) => {
                            const newSet = new Set(prev)
                            if (newSet.has(task.id)) {
                              newSet.delete(task.id)
                            } else {
                              newSet.add(task.id)
                            }
                            return newSet
                          })
                        }
                        className="task-btn expand-btn"
                      >
                        {isExpanded ? "▲" : "▼"}
                      </button>
                    )}

                    <button
                      onClick={() => (isTimerActive ? stopTimer(task.id) : startTimer(task.id))}
                      className={`task-btn timer-btn ${isTimerActive ? "active" : ""}`}
                    >
                      {isTimerActive ? "⏹️" : "▶️"}
                    </button>

                    {editingId === task.id ? (
                      <>
                        <button onClick={() => saveEdit(task.id)} className="task-btn save-btn">
                          💾
                        </button>
                        <button onClick={cancelEdit} className="task-btn cancel-btn">
                          ❌
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(task.id, task.text)} className="task-btn edit-btn">
                          ✏️
                        </button>
                        <button onClick={() => deleteTask(task.id)} className="task-btn delete-btn">
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="task-expanded">
                    {task.notes && (
                      <div className="task-notes">
                        <strong>Notes:</strong>
                        <br />
                        {task.notes}
                      </div>
                    )}

                    {task.subtasks.length > 0 && (
                      <div className="subtasks">
                        <div className="subtasks-title">
                          Subtasks ({completedSubtasks}/{task.subtasks.length})
                        </div>
                        {task.subtasks.map((subtask) => (
                          <div key={subtask.id} className="subtask-item">
                            <input
                              type="checkbox"
                              checked={subtask.completed}
                              onChange={() => toggleSubtask(task.id, subtask.id)}
                              className="subtask-checkbox"
                            />
                            <span className={`subtask-text ${subtask.completed ? "completed" : ""}`}>
                              {subtask.text}
                            </span>
                            <button
                              onClick={() => deleteSubtask(task.id, subtask.id)}
                              className="task-btn delete-btn"
                              style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}

                        <div className="subtask-input">
                          <input
                            type="text"
                            placeholder="Add subtask..."
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                const input = e.target as HTMLInputElement
                                addSubtask(task.id, input.value)
                                input.value = ""
                              }
                            }}
                          />
                          <button
                            onClick={(e) => {
                              const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement
                              addSubtask(task.id, input.value)
                              input.value = ""
                            }}
                            className="subtask-add-btn"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {showTemplates && (
          <div className="templates-modal" onClick={() => setShowTemplates(false)}>
            <div className="templates-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal" onClick={() => setShowTemplates(false)}>
                ×
              </button>
              <h2 className="templates-title">Task Templates</h2>
              {templates.map((template) => (
                <div key={template.id} className="template-item" onClick={() => createFromTemplate(template)}>
                  <div className="template-name">{template.name}</div>
                  <div className="template-description">{template.text}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "5px" }}>
                    {template.category} • {template.priority} priority • {template.subtasks.length} subtasks
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
