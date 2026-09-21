import { render } from 'preact';

function Popup() {
  return (
    <div style={{ width: '320px', padding: '16px', fontFamily: 'sans-serif' }}>
      <h2>LLM 划词翻译</h2>
      <p>准备就绪</p>
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<Popup />, root);
}
