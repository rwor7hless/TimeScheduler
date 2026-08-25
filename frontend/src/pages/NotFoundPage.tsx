import { Link } from 'react-router-dom'

/**
 * Ловушка для несуществующих путей. Без неё React Router не отрисовывает
 * ничего — пользователь получает пустую страницу без шапки и навигации и не
 * понимает, приложение сломалось или он ошибся адресом.
 */
export default function NotFoundPage() {
  return (
    <div>
      <div className="topbar">
        <div>
          <h1 className="page-title">404</h1>
          <p className="page-sub">Такой страницы нет</p>
        </div>
      </div>
      <Link to="/today" className="ts-btn">
        На «Мой день»
      </Link>
    </div>
  )
}
