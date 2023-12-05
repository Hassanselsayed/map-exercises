export function enableButton(btn) {
  btn.removeAttribute('disabled');
}

export function disableButton(btn) {
  btn.setAttribute('disabled', true);
}

export function removeElement(el) {
  el.remove();
}

export function showElement(el) {
  el.classList.remove('hidden');
}

export function hideElement(el) {
  el.classList.add('hidden');
}
