import { render } from 'preact';

function Options() {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif' }}>
      <h1>LLM 划词翻译 - 设置</h1>
      <p>准备就绪</p>
    </div>
  );
}

const root = document.getElementById('app');
if (root) {
  render(<Options />, root);
}
