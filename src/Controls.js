// src/controls.js
export const Controls = {
  forward:  'forward',
  backward: 'backward',
  left:     'left',
  right:    'right',
  brake:    'brake',
}

export const keyMap = [
  { name: Controls.forward,  keys: ['ArrowUp',    'KeyW'] },
  { name: Controls.backward, keys: ['ArrowDown',  'KeyS'] },
  { name: Controls.left,     keys: ['ArrowLeft',  'KeyA'] },
  { name: Controls.right,    keys: ['ArrowRight', 'KeyD'] },
  { name: Controls.brake,    keys: ['Space'] },
]