import { getAddress, setAddress } from './lib.js';

const select = document.getElementById('address');
const message = document.getElementById('message');

getAddress().then((address) => {
  select.value = address;
});

document.getElementById('save').addEventListener('click', async () => {
  await setAddress(select.value);
  message.className = 'ok';
  message.textContent = `Saved. Links will go to ${select.value}.`;
});
