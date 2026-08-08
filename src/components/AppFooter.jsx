import React from 'react';
import { Link } from 'react-router-dom';

export function AppFooter() {
  return (
    <footer className="ym-site-footer">
      <div className="ym-footer-inner">
        <span>依神网站汇总 · 发现优质网站，共建网络资源库</span>
        <nav className="ym-footer-links">
          <Link to="/about">关于</Link>
          <Link to="/changelog">更新记录</Link>
          <Link to="/contact">联系我们</Link>
          <a href="https://github.com/EmenWebsiteCollection/yishen-navigation/issues" target="_blank" rel="noreferrer">
            GitHub Issues
          </a>
        </nav>
      </div>
    </footer>
  );
}
