// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    displayCurrentDate();
    loadTasks();
    setupEnterKeyListeners();
    setupListDragHandlers();
    loadThemePreference();
});

// Display current date with ordinal suffix
function displayCurrentDate() {
    const date = new Date();
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    
    const suffix = getOrdinalSuffix(day);
    document.getElementById('current-date').textContent = `${day}${suffix} ${month}`;
}

function getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
    }
}

// Get today's date as string
function getTodayString() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Load tasks from localStorage (simulating todo.json)
function loadTasks() {
    const data = getStoredData();
    const today = getTodayString();
    
    // Check if we need to clean up completed tasks from previous days
    if (data.lastCleanupDate !== today) {
        cleanupCompletedTasks(data);
        data.lastCleanupDate = today;
        saveData(data);
    }
    
    // Clear all lists
    document.getElementById('high-list').innerHTML = '';
    document.getElementById('medium-list').innerHTML = '';
    document.getElementById('low-list').innerHTML = '';
    
    // Populate tasks
    data.tasks.forEach(task => {
        renderTask(task);
    });
}

// Clean up completed tasks from previous days
function cleanupCompletedTasks(data) {
    const today = getTodayString();
    data.tasks = data.tasks.filter(task => {
        // Keep tasks that are not completed OR tasks from today
        return !task.completed || task.date === today;
    });
}

// Get stored data from localStorage
function getStoredData() {
    const stored = localStorage.getItem('todoData');
    if (stored) {
        return JSON.parse(stored);
    }
    return {
        tasks: [],
        lastCleanupDate: getTodayString()
    };
}

// Save data to localStorage
function saveData(data) {
    localStorage.setItem('todoData', JSON.stringify(data));
}

// Add a new task
function addTask(priority) {
    const input = document.getElementById(`${priority}-input`);
    const taskText = input.value.trim();
    
    if (taskText === '') {
        return;
    }
    
    const task = {
        id: Date.now(),
        task: taskText,
        priority: priority,
        date: getTodayString(),
        completed: false
    };
    
    // Save to storage
    const data = getStoredData();
    data.tasks.push(task);
    saveData(data);
    
    // Render task
    renderTask(task);
    
    // Clear input
    input.value = '';
}

// Render a single task
function renderTask(task) {
    const list = document.getElementById(`${task.priority}-list`);
    
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;
    li.draggable = true;
    if (task.completed) {
        li.classList.add('completed');
    }
    
    // Add drag event listeners
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('drop', handleDrop);
    li.addEventListener('dragleave', handleDragLeave);
    
    const checkbox = document.createElement('div');
    checkbox.className = 'checkbox';
    checkbox.onclick = () => toggleTask(task.id);
    
    const taskText = document.createElement('span');
    taskText.className = 'task-text';
    taskText.textContent = task.task;
    
    const taskActions = document.createElement('div');
    taskActions.className = 'task-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✎';
    editBtn.onclick = () => openEditModal(task.id);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '🗑';
    deleteBtn.onclick = () => deleteTask(task.id);
    
    taskActions.appendChild(editBtn);
    taskActions.appendChild(deleteBtn);
    
    li.appendChild(checkbox);
    li.appendChild(taskText);
    li.appendChild(taskActions);
    list.appendChild(li);
}

// Drag and drop handlers
let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.task-item').forEach(item => {
        item.classList.remove('drag-over');
    });
    document.querySelectorAll('.task-list').forEach(list => {
        list.classList.remove('drag-over-list');
    });
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedElement === this) return;
    
    e.dataTransfer.dropEffect = 'move';
    
    // Add visual feedback
    this.classList.add('drag-over');
    
    return false;
}

function handleDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    
    this.classList.remove('drag-over');
    
    if (draggedElement && draggedElement !== this) {
        // Get the list (column) where it was dropped
        const newList = this.parentElement;
        const newPriority = newList.id.replace('-list', '');
        
        // Update task priority in data
        const taskId = parseInt(draggedElement.dataset.id);
        const data = getStoredData();
        const task = data.tasks.find(t => t.id === taskId);
        
        if (task) {
            task.priority = newPriority;
        }
        
        // Insert before this element
        newList.insertBefore(draggedElement, this);
        
        // Update order in data
        updateTaskOrder();
    }
    
    return false;
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
    
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateTaskOrder() {
    const data = getStoredData();
    const newTasksOrder = [];
    
    // Collect tasks in the order they appear in each column
    ['high', 'medium', 'low'].forEach(priority => {
        const list = document.getElementById(`${priority}-list`);
        const items = list.querySelectorAll('.task-item');
        
        items.forEach(item => {
            const taskId = parseInt(item.dataset.id);
            const task = data.tasks.find(t => t.id === taskId);
            if (task) {
                newTasksOrder.push(task);
            }
        });
    });
    
    data.tasks = newTasksOrder;
    saveData(data);
}

// Add drag handlers to lists for empty column drops and column-level dragging
function setupListDragHandlers() {
    ['high', 'medium', 'low'].forEach(priority => {
        const list = document.getElementById(`${priority}-list`);
        
        list.addEventListener('dragenter', (e) => {
            e.preventDefault();
        });
        
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            
            if (draggedElement) {
                const afterElement = getDragAfterElement(list, e.clientY);
                
                if (afterElement == null) {
                    list.appendChild(draggedElement);
                } else {
                    list.insertBefore(draggedElement, afterElement);
                }
            }
            
            return false;
        });
        
        list.addEventListener('dragleave', (e) => {
            // Cleanup if needed
        });
        
        list.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (draggedElement) {
                const newPriority = priority;
                const taskId = parseInt(draggedElement.dataset.id);
                const data = getStoredData();
                const task = data.tasks.find(t => t.id === taskId);
                
                if (task) {
                    task.priority = newPriority;
                }
                
                // Ensure the element is in the list
                if (!list.contains(draggedElement)) {
                    list.appendChild(draggedElement);
                }
                
                updateTaskOrder();
            }
            
            return false;
        });
    });
}

// Toggle task completion
function toggleTask(taskId) {
    const data = getStoredData();
    const task = data.tasks.find(t => t.id === taskId);
    
    if (task) {
        task.completed = !task.completed;
        saveData(data);
        
        // Update UI
        const taskElement = document.querySelector(`[data-id="${taskId}"]`);
        if (taskElement) {
            taskElement.classList.toggle('completed');
        }
    }
}

// Delete task
function deleteTask(taskId) {
    const data = getStoredData();
    data.tasks = data.tasks.filter(t => t.id !== taskId);
    saveData(data);
    
    // Remove from UI
    const taskElement = document.querySelector(`[data-id="${taskId}"]`);
    if (taskElement) {
        taskElement.remove();
    }
}

// Setup Enter key listeners for all inputs
function setupEnterKeyListeners() {
    document.getElementById('high-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask('high');
    });
    
    document.getElementById('medium-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask('medium');
    });
    
    document.getElementById('low-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask('low');
    });
}

// Export data to todo.json (for demonstration)
function exportToJSON() {
    const data = getStoredData();
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'todo.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Edit modal functionality
let currentEditTaskId = null;

function openEditModal(taskId) {
    currentEditTaskId = taskId;
    const data = getStoredData();
    const task = data.tasks.find(t => t.id === taskId);
    
    if (task) {
        document.getElementById('edit-task-text').value = task.task;
        document.getElementById('edit-priority').value = task.priority;
        document.getElementById('edit-modal').classList.add('active');
    }
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('active');
    currentEditTaskId = null;
    document.getElementById('edit-task-text').value = '';
}

function saveEditedTask() {
    if (!currentEditTaskId) return;
    
    const newText = document.getElementById('edit-task-text').value.trim();
    const newPriority = document.getElementById('edit-priority').value;
    
    if (newText === '') {
        alert('Task cannot be empty');
        return;
    }
    
    const data = getStoredData();
    const task = data.tasks.find(t => t.id === currentEditTaskId);
    
    if (task) {
        const oldPriority = task.priority;
        task.task = newText;
        task.priority = newPriority;
        saveData(data);
        
        // If priority changed, reload all tasks to update UI
        if (oldPriority !== newPriority) {
            loadTasks();
        } else {
            // Just update the text in the current element
            const taskElement = document.querySelector(`[data-id="${currentEditTaskId}"]`);
            if (taskElement) {
                const taskTextElement = taskElement.querySelector('.task-text');
                taskTextElement.textContent = newText;
            }
        }
    }
    
    closeEditModal();
}

// Close modal when clicking outside the card
document.addEventListener('click', (e) => {
    const modal = document.getElementById('edit-modal');
    if (e.target === modal) {
        closeEditModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('edit-modal');
        if (modal.classList.contains('active')) {
            closeEditModal();
        }
    }
});

// Theme toggle functionality
function loadThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    const themeText = document.getElementById('theme-text');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeText.textContent = 'light';
    }
    
    themeText.addEventListener('click', toggleTheme);
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
    const isDarkMode = document.body.classList.contains('dark-mode');
    const themeText = document.getElementById('theme-text');
    
    themeText.textContent = isDarkMode ? 'light' : 'dark';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}
