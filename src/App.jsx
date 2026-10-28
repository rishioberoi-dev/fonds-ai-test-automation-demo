import { useEffect, useMemo, useState } from 'react'
import './App.css'

const currency = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
})

const formatCurrency = (value) => currency.format(value ?? 0)

async function requestPortfolioData() {
  const [dashboardResponse, fundsResponse] = await Promise.all([
    fetch('/api/dashboard'),
    fetch('/api/funds'),
  ])
  if (!dashboardResponse.ok || !fundsResponse.ok) {
    throw new Error('We could not load your demo portfolio. Please try again.')
  }
  const [dashboardData, fundData] = await Promise.all([
    dashboardResponse.json(),
    fundsResponse.json(),
  ])
  return { dashboardData, fundData }
}

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: '⌂' },
  { id: 'funds', label: 'Explore funds', icon: '◉' },
  { id: 'orders', label: 'Orders', icon: '↗' },
]

function App() {
  const [page, setPage] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [funds, setFunds] = useState([])
  const [selectedFund, setSelectedFund] = useState(null)
  const [orderFund, setOrderFund] = useState(null)
  const [orderSide, setOrderSide] = useState('buy')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('All funds')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [orderError, setOrderError] = useState('')
  const [orderSuccess, setOrderSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    try {
      const { dashboardData, fundData } = await requestPortfolioData()
      setError('')
      setDashboard(dashboardData)
      setFunds(fundData)
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the demo service.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    requestPortfolioData()
      .then(({ dashboardData, fundData }) => {
        if (!active) return
        setError('')
        setDashboard(dashboardData)
        setFunds(fundData)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Unable to connect to the demo service.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  const categories = useMemo(
    () => ['All funds', ...new Set(funds.map((fund) => fund.category))],
    [funds],
  )
  const visibleFunds = category === 'All funds'
    ? funds
    : funds.filter((fund) => fund.category === category)

  function openOrder(fund, side = 'buy') {
    setOrderFund(fund)
    setOrderSide(side)
    setAmount('')
    setOrderError('')
    setOrderSuccess('')
  }

  async function submitOrder(event) {
    event.preventDefault()
    setOrderError('')
    setOrderSuccess('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fundId: orderFund.id,
          side: orderSide,
          amount: Number(amount),
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        setOrderError(result.error || 'This demo order could not be placed.')
        return
      }
      setOrderSuccess(`${orderSide === 'buy' ? 'Buy' : 'Sell'} order placed successfully.`)
      await loadData()
      window.setTimeout(() => setOrderFund(null), 900)
    } catch (requestError) {
      setOrderError(requestError.message || 'Unable to place this demo order.')
    } finally {
      setSubmitting(false)
    }
  }

  function showFund(fund) {
    setSelectedFund(fund)
    setPage('fund-detail')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage('dashboard') }}>
          <span className="brand-mark">f</span>
          <span>folio<span className="brand-light">demo</span></span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={`nav-link ${page === item.id || (page === 'fund-detail' && item.id === 'funds') ? 'active' : ''}`}
              data-testid={`nav-${item.id}`}
              onClick={() => { setPage(item.id); setSelectedFund(null) }}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              {item.label}
              {item.id === 'orders' && dashboard?.recentOrders?.length > 0 && (
                <span className="nav-count">{dashboard.recentOrders.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="demo-notice">
            <span className="notice-icon">✦</span>
            <strong>Demo environment</strong>
            <p>All funds and prices are synthetic. No real trades are made.</p>
          </div>
          <button className="profile-button" data-testid="profile-menu">
            <span className="avatar">JD</span>
            <span className="profile-copy"><strong>Rishi Demo</strong><small>Personal account</small></span>
            <span className="profile-more">···</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageTitle(page)}</strong></div>
          <div className="topbar-actions"><span className="market-status"><i /> Demo mode active</span><button className="icon-button" aria-label="Notifications">♧<span className="notification-dot" /></button></div>
        </header>

        {error && <div className="error-banner" role="alert" data-testid="app-error">{error}<button onClick={loadData}>Retry</button></div>}
        {loading ? (
          <div className="loading-state" data-testid="loading-state"><span className="spinner" /> Loading your portfolio…</div>
        ) : (
          <>
            {page === 'dashboard' && dashboard && (
              <Dashboard
                dashboard={dashboard}
                onExplore={() => setPage('funds')}
                onFundClick={showFund}
                onOrder={openOrder}
                onOrders={() => setPage('orders')}
              />
            )}
            {page === 'funds' && (
              <section className="page-section" data-testid="fund-overview">
                <div className="page-heading">
                  <div><div className="eyebrow">THE DEMO COLLECTION</div><h1>Explore funds</h1><p>Discover a curated selection of synthetic investment funds.</p></div>
                  <span className="mock-tag"><span /> Mock products only</span>
                </div>
                <div className="filter-row" aria-label="Filter funds by category">
                  {categories.map((item) => <button key={item} className={`filter-chip ${category === item ? 'selected' : ''}`} data-testid={`filter-${slug(item)}`} onClick={() => setCategory(item)}>{item}</button>)}
                </div>
                <div className="fund-grid" data-testid="fund-list">
                  {visibleFunds.map((fund, index) => <FundCard key={fund.id} fund={fund} index={index} onClick={() => showFund(fund)} onBuy={() => openOrder(fund)} />)}
                </div>
                <p className="disclaimer">Illustrative demo data only. Fund names, identifiers and prices are entirely synthetic.</p>
              </section>
            )}
            {page === 'fund-detail' && selectedFund && (
              <FundDetails fund={selectedFund} onBack={() => setPage('funds')} onBuy={() => openOrder(selectedFund)} />
            )}
            {page === 'orders' && dashboard && <OrdersPage orders={dashboard.recentOrders} />}
          </>
        )}
      </main>

      {orderFund && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOrderFund(null) }}>
          <section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="order-title" data-testid="order-dialog">
            <button className="modal-close" aria-label="Close order dialog" data-testid="close-order" onClick={() => setOrderFund(null)}>×</button>
            <div className="modal-kicker">DEMO ORDER · {orderSide.toUpperCase()}</div>
            <h2 id="order-title">{orderSide === 'buy' ? 'Buy' : 'Sell'} {orderFund.name}</h2>
            <p className="modal-subtitle">{orderFund.id} <span>·</span> {orderFund.category}</p>
            <div className="order-price-line"><span>Mock price per unit</span><strong>{formatCurrency(orderFund.price)}</strong></div>
            <form onSubmit={submitOrder}>
              <label htmlFor="order-amount">Order amount</label>
              <div className="amount-input-wrap"><span>€</span><input id="order-amount" data-testid="order-amount" type="number" min="0.01" step="0.01" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>
              <p className="field-hint">Enter an amount in euros. This order is simulated instantly.</p>
              {orderError && <p className="form-message error-text" role="alert" data-testid="order-error">{orderError}</p>}
              {orderSuccess && <p className="form-message success-text" role="status" data-testid="order-success">{orderSuccess}</p>}
              <button className="primary-button full-width" type="submit" data-testid={orderSide === 'buy' ? 'buy-button' : 'sell-button'} disabled={submitting}>{submitting ? 'Placing demo order…' : `Confirm ${orderSide} order`}</button>
            </form>
            <p className="modal-disclaimer">No money is moved. This is a local demonstration only.</p>
          </section>
        </div>
      )}
    </div>
  )
}

function pageTitle(page) {
  if (page === 'fund-detail') return 'Fund details'
  return navigation.find((item) => item.id === page)?.label || 'Dashboard'
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '')
}

function Dashboard({ dashboard, onExplore, onFundClick, onOrder, onOrders }) {
  return (
    <section className="page-section dashboard-page" data-testid="dashboard">
      <div className="welcome-row">
        <div><div className="eyebrow">YOUR DEMO PORTFOLIO</div><h1>Good morning, Rishi <span className="wave">✳</span></h1><p>Here’s what’s happening with your demo portfolio.</p></div>
        <button className="primary-button" data-testid="explore-funds" onClick={onExplore}><span>＋</span> Explore funds</button>
      </div>
      <div className="metrics-grid">
        <article className="metric-card portfolio-card"><div className="metric-label">Total portfolio value <span className="metric-info" title="Cash plus the mock market value of your holdings">i</span></div><strong className="metric-value" data-testid="portfolio-value">{formatCurrency(dashboard.totalPortfolioValue)}</strong><div className="metric-foot"><span className="trend-positive">↗ 2.4%</span><span>since last month</span></div><div className="metric-sparkline" aria-hidden="true"><svg viewBox="0 0 170 46" preserveAspectRatio="none"><path d="M1 38 C19 35 23 25 37 31 S60 39 71 24 S91 29 103 20 S126 27 136 12 S154 18 169 4" /></svg></div></article>
        <article className="metric-card"><div className="metric-label">Available cash <span className="metric-info" title="Synthetic starting cash, adjusted by demo orders">i</span></div><strong className="metric-value" data-testid="cash-balance">{formatCurrency(dashboard.cashBalance)}</strong><div className="metric-foot"><span className="cash-dot" /> Ready to invest</div><div className="metric-decoration">€</div></article>
        <article className="metric-card"><div className="metric-label">Invested in funds</div><strong className="metric-value">{formatCurrency(dashboard.investedValue)}</strong><div className="metric-foot"><span>{dashboard.holdings.length} funds</span><span> in your portfolio</span></div><div className="holding-dots"><i /><i /><i /><i /><i /></div></article>
      </div>
      <div className="content-grid">
        <section className="panel holdings-panel">
          <div className="panel-heading"><div><h2>Your holdings</h2><p>Your demo investment positions</p></div><button className="text-button" onClick={onExplore} data-testid="view-all-funds">View funds <span>→</span></button></div>
          {dashboard.holdings.length ? <div className="table-scroll"><table><thead><tr><th>FUND</th><th>UNITS</th><th>MOCK PRICE</th><th>VALUE</th><th /></tr></thead><tbody>
            {dashboard.holdings.map((holding, index) => <tr key={holding.fundId} data-testid={`holding-${holding.fundId}`}><td><button className="table-fund" onClick={() => onFundClick(holding)}><span className={`fund-avatar avatar-${index % 5}`}>{holding.shortName}</span><span><strong>{holding.name}</strong><small>{holding.id}</small></span></button></td><td>{Number(holding.units).toFixed(2)}</td><td>{formatCurrency(holding.price)}</td><td><strong>{formatCurrency(holding.value)}</strong></td><td><div className="row-actions"><button className="row-action" aria-label={`Buy ${holding.name}`} onClick={() => onOrder(holding)}>＋</button><button className="row-sell" data-testid={`sell-holding-${holding.fundId}`} onClick={() => onOrder(holding, 'sell')}>Sell</button></div></td></tr>)}
          </tbody></table></div> : <EmptyState title="No holdings yet" text="Explore the demo funds to place your first simulated order." action="Explore funds" onClick={onExplore} />}
        </section>
        <section className="panel orders-panel">
          <div className="panel-heading"><div><h2>Recent orders</h2><p>Your latest demo activity</p></div><button className="text-button" onClick={onOrders} data-testid="view-all-orders">View all <span>→</span></button></div>
          {dashboard.recentOrders.length ? <div className="order-list">{dashboard.recentOrders.slice(0, 4).map((order) => <OrderRow key={order.id} order={order} />)}</div> : <EmptyState title="No orders yet" text="Your order activity will show up here." action="Find a fund" onClick={onExplore} />}
        </section>
      </div>
      <div className="bottom-note"><span>ⓘ</span> This is a test environment using synthetic products and prices. No real investments or transactions.</div>
    </section>
  )
}

function FundCard({ fund, index, onClick, onBuy }) {
  return (
    <article className="fund-card" data-testid={`fund-card-${fund.id}`}>
      <button className="fund-card-main" onClick={onClick} aria-label={`View details for ${fund.name}`}>
        <div className={`fund-illustration illustration-${index % 5}`}><span className="illustration-symbol">{['◌', '⌁', '▧', '✳', '◈'][index % 5]}</span><span className="illustration-label">{fund.shortName}</span></div>
        <div className="fund-card-content"><span className="category-label">{fund.category}</span><h2>{fund.name}</h2><p>{fund.description}</p><div className="fund-card-meta"><span>Risk <strong>{fund.riskLevel} / 7</strong></span><span className="risk-meter"><i style={{ width: `${(fund.riskLevel / 7) * 100}%` }} /></span></div><div className="fund-card-price"><span>Mock price</span><strong>{formatCurrency(fund.price)}</strong></div></div>
      </button>
      <div className="fund-card-footer"><span className="product-id">{fund.id}</span><button className="secondary-button" data-testid={`buy-fund-${fund.id}`} onClick={onBuy}>Buy <span>↗</span></button></div>
    </article>
  )
}

function FundDetails({ fund, onBack, onBuy }) {
  return (
    <section className="page-section detail-page" data-testid="fund-details">
      <button className="back-button" onClick={onBack} data-testid="back-to-funds">← <span>Back to funds</span></button>
      <div className="detail-layout">
        <div className={`detail-art illustration-${fund.colorIndex}`}><span>{fund.shortName}</span><i>✳</i><small>FOLIO / SYNTHETIC COLLECTION</small></div>
        <div className="detail-copy">
          <div className="eyebrow">{fund.category}</div><h1>{fund.name}</h1><p className="detail-description">{fund.description}</p>
          <div className="detail-stats"><div><span>Product ID</span><strong data-testid="fund-product-id">{fund.id}</strong></div><div><span>Mock price</span><strong data-testid="fund-price">{formatCurrency(fund.price)}</strong></div><div><span>Risk indicator</span><strong><span className="risk-pill">Level {fund.riskLevel} of 7</span></strong></div></div>
          <div className="detail-notice">ⓘ This fund and its price are entirely synthetic and created for this demo.</div>
          <button className="primary-button detail-buy" data-testid="fund-detail-buy" onClick={onBuy}>Buy this fund <span>→</span></button>
        </div>
      </div>
      <section className="panel about-fund"><div className="eyebrow">FUND OVERVIEW</div><h2>About this fund</h2><p>{fund.longDescription}</p><div className="about-tags"><span>{fund.category}</span><span>Demo product</span><span>Mock price</span></div></section>
    </section>
  )
}

function OrdersPage({ orders }) {
  return (
    <section className="page-section" data-testid="orders-page">
      <div className="page-heading"><div><div className="eyebrow">PORTFOLIO ACTIVITY</div><h1>Orders</h1><p>Review your simulated demo transactions.</p></div></div>
      <section className="panel all-orders-panel"><div className="panel-heading"><div><h2>Order history</h2><p>{orders.length} {orders.length === 1 ? 'order' : 'orders'} in this demo</p></div><span className="mock-tag"><span /> Simulation only</span></div>
        {orders.length ? <div className="table-scroll"><table><thead><tr><th>FUND</th><th>TYPE</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} data-testid={`order-row-${order.id}`}><td><span className="order-fund-name"><span className={`mini-order-icon ${order.side === 'buy' ? 'buy-icon' : 'sell-icon'}`}>{order.side === 'buy' ? '↗' : '↙'}</span><span><strong>{order.fundName}</strong><small>{order.fundId}</small></span></span></td><td><span className={`side-label ${order.side}`}>{order.side === 'buy' ? 'Buy' : 'Sell'}</span></td><td>{new Date(order.createdAt).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' })}</td><td><strong>{formatCurrency(order.amount)}</strong></td><td><span className="status-pill">Completed</span></td></tr>)}</tbody></table></div> : <EmptyState title="No orders yet" text="Simulated orders you place will appear here." />}
      </section>
      <div className="bottom-note"><span>ⓘ</span> Every order is simulated locally. No financial products are bought or sold.</div>
    </section>
  )
}

function OrderRow({ order }) {
  return <div className="order-row"><span className={`mini-order-icon ${order.side === 'buy' ? 'buy-icon' : 'sell-icon'}`}>{order.side === 'buy' ? '↗' : '↙'}</span><span className="order-row-copy"><strong>{order.side === 'buy' ? 'Buy' : 'Sell'} {order.fundName}</strong><small>{new Date(order.createdAt).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} · {order.fundId}</small></span><span className="order-row-amount">{formatCurrency(order.amount)}</span></div>
}

function EmptyState({ title, text, action, onClick }) {
  return <div className="empty-state"><span className="empty-icon">◌</span><strong>{title}</strong><p>{text}</p>{action && <button className="text-button" onClick={onClick}>{action} →</button>}</div>
}

export default App
