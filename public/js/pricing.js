// Billing period toggle. Prices are example values until payments are connected.
const PRICES = { month: { member: '29', note: 'per month' }, year: { member: '24', note: 'per month, billed yearly' } };
const buttons = document.querySelectorAll('[data-period]');

function set(period) {
  buttons.forEach((b) => { b.classList.toggle('on', b.dataset.period === period); b.setAttribute('aria-pressed', String(b.dataset.period === period)); });
  document.getElementById('price-member').textContent = PRICES[period].member;
  document.getElementById('note-member').textContent = PRICES[period].note;
}
buttons.forEach((b) => b.addEventListener('click', () => set(b.dataset.period)));
set('month');
