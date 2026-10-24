// Opens figure images full-screen. Tapping the image toggles between fit-to-screen
// and actual size, and pinch-zoom works inside the viewer. Without JavaScript,
// the link opens the image file directly.
const view = document.createElement('dialog');
view.className = 'zoom-view';
view.innerHTML =
  '<div class="frame"><img alt=""></div>' +
  '<div class="bar"><p></p><a target="_blank" rel="noopener">Original</a><button type="button" autofocus>Close</button></div>';
const img = view.querySelector('img');
const caption = view.querySelector('p');
const original = view.querySelector('a');

document.addEventListener('click', (event) => {
  const link = event.target.closest('a.zoom');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
  event.preventDefault();
  if (!view.isConnected) document.body.append(view);
  const source = link.querySelector('img');
  img.src = link.href;
  img.alt = source.alt;
  caption.textContent =
    link.parentElement.querySelector('figcaption')?.textContent || source.alt;
  original.href = link.href;
  view.classList.remove('full');
  view.showModal();
});

img.addEventListener('click', () => view.classList.toggle('full'));
view.querySelector('button').addEventListener('click', () => view.close());
view.addEventListener('click', (event) => {
  if (event.target.classList.contains('frame')) view.close();
});
