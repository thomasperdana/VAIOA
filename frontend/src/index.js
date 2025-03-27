import './style.css'; // Import CSS file (we'll create this next)

console.log('Bible Study Tool Initialized!');

// Basic function to demonstrate
function component() {
  const element = document.createElement('div');
  element.innerHTML = 'Welcome to the Bible Study Tool!';
  return element;
}

document.getElementById('app').appendChild(component());