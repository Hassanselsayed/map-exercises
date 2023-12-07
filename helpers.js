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

export function timeout(s) {
  return new Promise(function (_, reject) {
    setTimeout(function () {
      reject(new Error(`Request took too long! Timeout after ${s} second`));
    }, s * 1000);
  });
}

export const getJSON = async function (url, options) {
  try {
    const res = await Promise.race([fetch(url, options), timeout(10)]);
    const data = await res.json();

    if (!res.ok) throw new Error(`${data.message} (error ${res.status})`);
    return data;
  } catch (err) {
    throw err;
  }
};
