// Import dependencies
import { ROOMS_AND_TASKS } from './rooms-and-tasks.js';
import { gameState } from './game-state.js';

// Initialize rooms/tasks UI
function initializeRoomsAndTasks() {
const container = document.getElementById('rooms-tasks-container');

container.innerHTML = '';

console.log('ROOMS_AND_TASKS keys:', Object.keys(ROOMS_AND_TASKS));
console.log('Total rooms:', Object.keys(ROOMS_AND_TASKS).length);

// Ensure selectedRooms exists (defensive programming)
if (!gameState.settings.selectedRooms) {
  console.warn('selectedRooms was undefined, initializing as empty object');
  gameState.settings.selectedRooms = {};
}

Object.keys(ROOMS_AND_TASKS).forEach(roomName => {
console.log('Initializing room:', roomName);
// Initialize in gameState
gameState.settings.selectedRooms[roomName] = {
enabled: true,
tasks: ROOMS_AND_TASKS[roomName].map((task, i) => ({
name: task,
enabled: true,
unique: false
}))
};
});

console.log('gameState.settings.selectedRooms:', Object.keys(gameState.settings.selectedRooms));
renderAllRooms();

// Add "Add Room" button
const addRoomBtn = document.createElement('button');
addRoomBtn.id = 'add-room-btn';
addRoomBtn.className = 'btn-primary';
addRoomBtn.innerHTML = '➕ Add Room';
addRoomBtn.onclick = showAddRoomModal;
container.appendChild(addRoomBtn);
}

function renderAllRooms() {
const container = document.getElementById('rooms-tasks-container');

// Clear all room sections (but keep the add room button if it exists)
const sections = container.querySelectorAll('.room-section');
sections.forEach(section => section.remove());

console.log('renderAllRooms - Rooms to render:', Object.keys(gameState.settings.selectedRooms));
Object.keys(gameState.settings.selectedRooms).forEach(roomName => {
console.log('Rendering room:', roomName);
renderRoom(roomName);
});
}

function renderRoom(roomName) {
const container = document.getElementById('rooms-tasks-container');
const addRoomBtn = document.getElementById('add-room-btn');

const roomSection = document.createElement('div');
roomSection.className = 'room-section';
roomSection.id = `room-section-${roomName}`;

const roomHeader = document.createElement('div');
roomHeader.className = 'room-header';
roomHeader.innerHTML = `
<input type="checkbox" class="room-checkbox" id="room-${roomName}" onchange="toggleRoom('${roomName}')" ${gameState.settings.selectedRooms[roomName].enabled ? 'checked' : ''}>
<label for="room-${roomName}">${roomName}</label>
<button onclick="deleteRoom('${roomName}')" class="btn-danger btn-small room-delete-btn">🗑️ Delete</button>
`;

const taskList = document.createElement('ul');
taskList.className = 'task-list';
taskList.id = `tasks-${roomName}`;

gameState.settings.selectedRooms[roomName].tasks.forEach((task, index) => {
renderTask(roomName, index, taskList);
});

// Add "Add Task" button
const addTaskBtn = document.createElement('button');
addTaskBtn.className = 'btn-primary btn-small add-task-btn';
addTaskBtn.innerHTML = '➕ Add Task';
addTaskBtn.onclick = () => showAddTaskModal(roomName);

roomSection.appendChild(roomHeader);
roomSection.appendChild(taskList);
roomSection.appendChild(addTaskBtn);

// Insert before the "Add Room" button or at the end
if (addRoomBtn) {
container.insertBefore(roomSection, addRoomBtn);
} else {
container.appendChild(roomSection);
}
}

function renderTask(roomName, taskIndex, taskList) {
const task = gameState.settings.selectedRooms[roomName].tasks[taskIndex];

// Create wrapper for swipe functionality
const wrapper = document.createElement('li');
wrapper.className = 'task-item-wrapper';
wrapper.id = `task-wrapper-${roomName}-${taskIndex}`;

const isRoomDisabled = !gameState.settings.selectedRooms[roomName].enabled;

// Create the task item
const taskItem = document.createElement('div');
taskItem.className = 'task-item';
taskItem.id = `task-item-${roomName}-${taskIndex}`;
taskItem.innerHTML = `
<input type="checkbox" id="task-${roomName}-${taskIndex}" ${task.enabled ? 'checked' : ''} ${isRoomDisabled ? 'disabled' : ''} onchange="toggleTaskEnabled('${roomName}', ${taskIndex})" class="task-enable-checkbox">
<label for="task-${roomName}-${taskIndex}" id="task-label-${roomName}-${taskIndex}">${task.name}</label>
<button onclick="handleTaskDelete('${roomName}', ${taskIndex})" class="btn-danger btn-small task-delete-btn-desktop">🗑️</button>
`;

// Store room name and task index for drag and drop and swipe
taskItem.dataset.roomName = roomName;
taskItem.dataset.taskIndex = taskIndex;

// Create delete button that appears when swiped
const deleteReveal = document.createElement('div');
deleteReveal.className = 'task-delete-reveal';
deleteReveal.innerHTML = '<span class="task-delete-icon">🗑️</span>';
deleteReveal.onclick = () => handleTaskDelete(roomName, taskIndex);

wrapper.appendChild(deleteReveal);
wrapper.appendChild(taskItem);
taskList.appendChild(wrapper);

// Only add swipe handlers in edit mode on mobile devices
if (isEditMode && isMobile) {
setupSwipeHandlers(taskItem, roomName, taskIndex);
}
}

// Device Detection
function isMobileDevice() {
return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
|| (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

// Edit Mode Toggle
let isEditMode = false;
const isMobile = isMobileDevice();

function toggleEditMode() {
isEditMode = !isEditMode;
const container = document.getElementById('rooms-tasks-container');
const btn = document.getElementById('edit-mode-btn');

if (isEditMode) {
container.classList.add('edit-mode');
// Add device-specific class
container.classList.add(isMobile ? 'mobile' : 'desktop');
btn.classList.add('active');
btn.innerHTML = '✅ Done Editing';
enableDragAndDrop();

// Only enable swipe on mobile
if (isMobile) {
enableSwipeHandlers();
}
} else {
container.classList.remove('edit-mode', 'mobile', 'desktop');
btn.classList.remove('active');
btn.innerHTML = '✏️ Edit Mode';
disableDragAndDrop();

// Only disable swipe if it was enabled
if (isMobile) {
disableSwipeHandlers();
}
}
}

// Swipe-to-Delete functionality
function enableSwipeHandlers() {
const taskItems = document.querySelectorAll('.task-item');
taskItems.forEach(item => {
const roomName = item.dataset.roomName;
const taskIndex = item.dataset.taskIndex;
setupSwipeHandlers(item, roomName, taskIndex);
});
}

function disableSwipeHandlers() {
const taskItems = document.querySelectorAll('.task-item');
taskItems.forEach(item => {
item.classList.remove('swiped');
// Remove event listeners by cloning and replacing
const newItem = item.cloneNode(true);
item.parentNode.replaceChild(newItem, item);
});
}

function setupSwipeHandlers(element, roomName, taskIndex) {
let startX = 0;
let currentX = 0;
let isSwiping = false;

element.addEventListener('touchstart', handleTouchStart, { passive: true });
element.addEventListener('touchmove', handleTouchMove, { passive: false });
element.addEventListener('touchend', handleTouchEnd);

// Mouse support for testing on desktop
element.addEventListener('mousedown', handleTouchStart);
element.addEventListener('mousemove', handleTouchMove);
element.addEventListener('mouseup', handleTouchEnd);

function handleTouchStart(e) {
// Close other swiped items
document.querySelectorAll('.task-item.swiped').forEach(item => {
if (item !== element) {
item.classList.remove('swiped');
}
});

startX = e.touches ? e.touches[0].clientX : e.clientX;
isSwiping = true;
}

function handleTouchMove(e) {
if (!isSwiping) return;

currentX = e.touches ? e.touches[0].clientX : e.clientX;
const diff = startX - currentX;

// Only allow swipe left (positive diff)
if (diff > 0 && diff < 100) {
// Only prevent default if user is actually swiping (> 10px threshold)
// This allows normal taps to work while preventing scroll during swipe
if (diff > 10) {
e.preventDefault();
}
// Temporarily disable transition for smooth following
element.style.transition = 'none';
element.style.transform = `translateX(-${diff}px)`;
}
}

function handleTouchEnd(e) {
if (!isSwiping) return;
isSwiping = false;

const diff = startX - currentX;

// Re-enable transition for snap animation
element.style.transition = '';

// If already swiped and user swipes left again, delete
if (element.classList.contains('swiped') && diff > 30) {
handleTaskDelete(roomName, taskIndex);
return;
}

// Threshold for revealing delete (40px)
if (diff > 40) {
element.classList.add('swiped');
element.style.transform = ''; // Let CSS class handle position
} else {
element.classList.remove('swiped');
element.style.transform = ''; // Return to normal position
}
}
}

function handleTaskDelete(roomName, taskIndex) {
deleteTask(roomName, taskIndex);
}

// Drag and Drop functionality
let draggedTask = null;

function enableDragAndDrop() {
const taskItems = document.querySelectorAll('.task-item');
const taskLists = document.querySelectorAll('.task-list');

taskItems.forEach(item => {
item.setAttribute('draggable', 'true');
item.addEventListener('dragstart', handleDragStart);
item.addEventListener('dragend', handleDragEnd);
item.addEventListener('dragover', handleDragOver);
item.addEventListener('drop', handleDrop);
});

taskLists.forEach(list => {
list.addEventListener('dragover', handleListDragOver);
list.addEventListener('drop', handleListDrop);
});
}

function disableDragAndDrop() {
const taskItems = document.querySelectorAll('.task-item');
const taskLists = document.querySelectorAll('.task-list');

taskItems.forEach(item => {
item.removeAttribute('draggable');
item.removeEventListener('dragstart', handleDragStart);
item.removeEventListener('dragend', handleDragEnd);
item.removeEventListener('dragover', handleDragOver);
item.removeEventListener('drop', handleDrop);
});

taskLists.forEach(list => {
list.removeEventListener('dragover', handleListDragOver);
list.removeEventListener('drop', handleListDrop);
});
}

function handleDragStart(e) {
draggedTask = this;
this.classList.add('dragging');
e.dataTransfer.effectAllowed = 'move';
e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
this.classList.remove('dragging');

// Remove all drag-over classes
document.querySelectorAll('.drag-over').forEach(el => {
el.classList.remove('drag-over');
});
}

function handleDragOver(e) {
if (e.preventDefault) {
e.preventDefault();
}
e.dataTransfer.dropEffect = 'move';

if (this !== draggedTask) {
this.classList.add('drag-over');
}
return false;
}

function handleDrop(e) {
if (e.stopPropagation) {
e.stopPropagation();
}

this.classList.remove('drag-over');

if (draggedTask !== this) {
// Get source and target information
const sourceRoom = draggedTask.dataset.roomName;
const sourceIndex = parseInt(draggedTask.dataset.taskIndex);
const targetRoom = this.dataset.roomName;
const targetIndex = parseInt(this.dataset.taskIndex);

// Move task
moveTask(sourceRoom, sourceIndex, targetRoom, targetIndex);
}

return false;
}

function handleListDragOver(e) {
if (e.preventDefault) {
e.preventDefault();
}
e.dataTransfer.dropEffect = 'move';
return false;
}

function handleListDrop(e) {
if (e.stopPropagation) {
e.stopPropagation();
}

// Get the room name from the list id (format: tasks-RoomName)
const targetRoom = this.id.replace('tasks-', '');
const sourceRoom = draggedTask.dataset.roomName;
const sourceIndex = parseInt(draggedTask.dataset.taskIndex);

// Move to end of target room
if (sourceRoom !== targetRoom || sourceIndex !== gameState.settings.selectedRooms[targetRoom].tasks.length - 1) {
moveTaskToRoom(sourceRoom, sourceIndex, targetRoom);
}

return false;
}

function moveTask(sourceRoom, sourceIndex, targetRoom, targetIndex) {
// Get the task to move
const task = gameState.settings.selectedRooms[sourceRoom].tasks[sourceIndex];

// Remove from source
gameState.settings.selectedRooms[sourceRoom].tasks.splice(sourceIndex, 1);

// Add to target
if (sourceRoom === targetRoom) {
// Same room, adjust index if needed
if (sourceIndex < targetIndex) {
targetIndex--;
}
}
gameState.settings.selectedRooms[targetRoom].tasks.splice(targetIndex, 0, task);

// Re-render both rooms
renderAllRooms();
if (isEditMode) {
enableDragAndDrop();
}
}

function moveTaskToRoom(sourceRoom, sourceIndex, targetRoom) {
// Get the task to move
const task = gameState.settings.selectedRooms[sourceRoom].tasks[sourceIndex];

// Remove from source
gameState.settings.selectedRooms[sourceRoom].tasks.splice(sourceIndex, 1);

// Add to end of target
gameState.settings.selectedRooms[targetRoom].tasks.push(task);

// Re-render all rooms
renderAllRooms();
if (isEditMode) {
enableDragAndDrop();
}
}

// Room CRUD operations
function showAddRoomModal() {
const roomName = prompt('Enter room name:');
if (roomName && roomName.trim()) {
const trimmedName = roomName.trim();
if (gameState.settings.selectedRooms[trimmedName]) {
alert('A room with this name already exists!');
return;
}
addRoom(trimmedName);
}
}

function addRoom(roomName) {
gameState.settings.selectedRooms[roomName] = {
enabled: true,
tasks: []
};
renderRoom(roomName);
updateMeetingRoomDropdown();
}

function deleteRoom(roomName) {
if (confirm(`Are you sure you want to delete the room "${roomName}" and all its tasks?`)) {
delete gameState.settings.selectedRooms[roomName];
const roomSection = document.getElementById(`room-section-${roomName}`);
if (roomSection) {
roomSection.remove();
}
updateMeetingRoomDropdown();
}
}

// Task CRUD operations
function showAddTaskModal(roomName) {
const taskName = prompt('Enter task description:');
if (taskName && taskName.trim()) {
addTask(roomName, taskName.trim());
}
}

function addTask(roomName, taskName) {
gameState.settings.selectedRooms[roomName].tasks.push({
name: taskName,
enabled: true,
unique: false
});

const taskList = document.getElementById(`tasks-${roomName}`);
const taskIndex = gameState.settings.selectedRooms[roomName].tasks.length - 1;
renderTask(roomName, taskIndex, taskList);

// Apply current unique visibility setting
toggleUniqueVisibility();
}

function deleteTask(roomName, taskIndex) {
gameState.settings.selectedRooms[roomName].tasks.splice(taskIndex, 1);

// Re-render all tasks in this room to fix indices
const taskList = document.getElementById(`tasks-${roomName}`);
taskList.innerHTML = '';
gameState.settings.selectedRooms[roomName].tasks.forEach((task, index) => {
renderTask(roomName, index, taskList);
});

// Apply current unique visibility setting
toggleUniqueVisibility();

// Re-enable swipe handlers if in edit mode
if (isEditMode) {
enableSwipeHandlers();
}
}

function toggleCollapsible(element) {
element.classList.toggle('active');
const content = element.nextElementSibling;
content.classList.toggle('active');
}

function updateMeetingRoomDropdown() {
const meetingRoomSelect = document.getElementById('meeting-room');
const currentValue = meetingRoomSelect.value;

// Clear and rebuild dropdown
meetingRoomSelect.innerHTML = '<option value="">Select a room...</option>';

// Only add enabled rooms
Object.keys(gameState.settings.selectedRooms).forEach(roomName => {
if (gameState.settings.selectedRooms[roomName].enabled) {
const option = document.createElement('option');
option.value = roomName;
option.textContent = roomName;
meetingRoomSelect.appendChild(option);
}
});

// Restore previous selection if room is still enabled
if (currentValue && gameState.settings.selectedRooms[currentValue]?.enabled) {
meetingRoomSelect.value = currentValue;
}
}

function toggleRoom(roomName) {
const checkbox = document.getElementById(`room-${roomName}`);
const taskList = document.getElementById(`tasks-${roomName}`);
taskList.style.opacity = checkbox.checked ? '1' : '0.3';
gameState.settings.selectedRooms[roomName].enabled = checkbox.checked;

// When unchecking a room, also uncheck and disable all its tasks
if (!checkbox.checked) {
gameState.settings.selectedRooms[roomName].tasks.forEach((task, index) => {
const taskCheckbox = document.getElementById(`task-${roomName}-${index}`);
if (taskCheckbox) {
taskCheckbox.checked = false;
taskCheckbox.disabled = true;
task.enabled = false;
}
});
} else {
// When checking a room, re-enable all its tasks
gameState.settings.selectedRooms[roomName].tasks.forEach((task, index) => {
const taskCheckbox = document.getElementById(`task-${roomName}-${index}`);
if (taskCheckbox) {
taskCheckbox.checked = true;
taskCheckbox.disabled = false;
task.enabled = true;
}
});
}

// Update meeting room dropdown to reflect enabled rooms
updateMeetingRoomDropdown();
}

function toggleTaskEnabled(roomName, taskIndex) {
const checkbox = document.getElementById(`task-${roomName}-${taskIndex}`);
gameState.settings.selectedRooms[roomName].tasks[taskIndex].enabled = checkbox.checked;
}

function toggleTaskUnique(roomName, taskIndex) {
const checkbox = document.getElementById(`unique-${roomName}-${taskIndex}`);
gameState.settings.selectedRooms[roomName].tasks[taskIndex].unique = checkbox.checked;
}

function toggleUniqueVisibility() {
const uniqueMode = document.querySelector('input[name="unique-mode"]:checked').value;
const uniqueControls = document.querySelectorAll('.unique-control');

if (uniqueMode === 'manual') {
uniqueControls.forEach(control => {
control.style.display = 'flex';
});
} else {
uniqueControls.forEach(control => {
control.style.display = 'none';
});
}
}

function setupUniqueRadioListeners() {
const radioButtons = document.querySelectorAll('input[name="unique-mode"]');
radioButtons.forEach(radio => {
radio.addEventListener('change', toggleUniqueVisibility);
});
}

// Export for testing and module usage
export {
  initializeRoomsAndTasks,
  renderAllRooms,
  renderRoom,
  renderTask,
  isMobileDevice,
  toggleEditMode,
  enableSwipeHandlers,
  disableSwipeHandlers,
  setupSwipeHandlers,
  handleTaskDelete,
  enableDragAndDrop,
  disableDragAndDrop,
  moveTask,
  moveTaskToRoom,
  showAddRoomModal,
  addRoom,
  deleteRoom,
  showAddTaskModal,
  addTask,
  deleteTask,
  toggleRoom,
  toggleTaskEnabled,
  toggleCollapsible,
  toggleUniqueVisibility,
  setupUniqueRadioListeners,
  updateMeetingRoomDropdown
};
