import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, ChevronDown, CreditCard, Landmark, Loader2, Lock, ShieldCheck, Smartphone, Wallet, XCircle } from 'lucide-react'
import { ApiError, api, beacon } from '../lib/api'
import { inrFromPaise } from '../lib/format'

/**
 * Simulated payment gateway UI (used when the API has no Razorpay keys). The server owns the state machine
 * (see backend/src/services/demoPaymentService.js); this component just drives it and looks like a real checkout.
 */

const ACTIVE = ['awaiting_otp', 'awaiting_approval', 'awaiting_bank', 'processing']
const BANKS = ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'Punjab National Bank']
const WALLETS = ['Paytm', 'PhonePe', 'Amazon Pay', 'MobiKwik']
const HANDLES = ['@okhdfcbank', '@oksbi', '@ybl', '@paytm']
const METHODS = [
  { id: 'upi', label: 'UPI', hint: 'Pay with any UPI app', icon: Smartphone },
  { id: 'card', label: 'Cards', hint: 'Credit or debit card', icon: CreditCard },
  { id: 'netbanking', label: 'Net banking', hint: 'All major Indian banks', icon: Landmark },
  { id: 'wallet', label: 'Wallets', hint: 'Paytm, PhonePe and more', icon: Wallet },
]
const TEST_CARDS = [
  { label: 'Instant success', number: '4111 1111 1111 1111' },
  { label: 'Asks for OTP', number: '4000 0000 0000 3220' },
  { label: 'Declined', number: '4000 0000 0000 0002' },
  { label: 'Insufficient funds', number: '4000 0000 0000 9995' },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const digits = (s) => s.replace(/\D/g, '')

function luhn(n) {
  let sum = 0
  for (let i = 0; i < n.length; i++) {
    let d = Number(n[n.length - 1 - i])
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2
    sum += d
  }
  return sum % 10 === 0
}
const brandOf = (n) => (/^4/.test(n) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(n) ? 'Mastercard' : /^(60|65|81|82|508)/.test(n) ? 'RuPay' : /^3[47]/.test(n) ? 'Amex' : '')
const formatCard = (v) => {
  const d = digits(v).slice(0, 19)
  return (/^3[47]/.test(d) ? d.replace(/^(\d{0,4})(\d{0,6})(\d{0,5}).*/, (_, a, b, c) => [a, b, c].filter(Boolean).join(' ')) : d.replace(/(\d{4})(?=\d)/g, '$1 '))
}
const formatExpiry = (v) => {
  const d = digits(v).slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function useCountdown(expiresAt) {
  const end = expiresAt ? new Date(expiresAt).getTime() : null
  const [left, setLeft] = useState(end ? Math.max(0, Math.round((end - Date.now()) / 1000)) : null)
  useEffect(() => {
    if (!end) return
    const tick = () => setLeft(Math.max(0, Math.round((end - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 500)
    return () => clearInterval(t)
  }, [end])
  return left
}

export default function DemoPayment({ booking, onPaid, reload }) {
  const id = booking._id
  const total = booking.pricing.total
  const [method, setMethod] = useState('upi')
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', name: '' })
  const [vpa, setVpa] = useState('')
  const [bank, setBank] = useState('')
  const [wallet, setWallet] = useState('')
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [showTest, setShowTest] = useState(false)
  const [gw, setGw] = useState(null) // { phase: 'processing' | 'attempt', label, attempt }
  const lastPayload = useRef(null)

  // Opening checkout while a payment is still "in flight" means the page was refreshed or closed mid-payment:
  // like a real gateway, that payment is cancelled (the reservation and its hold stay).
  useEffect(() => {
    const attempts = booking.payment.attempts || []
    const live = attempts.find((a) => ACTIVE.includes(a.status))
    if (!live) {
      // the browser may already have cancelled it as the page unloaded; still tell the user what happened
      const last = attempts[attempts.length - 1]
      if (last?.status === 'abandoned' && Date.now() - new Date(last.updatedAt).getTime() < 5 * 60 * 1000) {
        setNotice({ type: 'warn', text: 'Your last payment was cancelled because the page was refreshed or closed during payment. Your dates are still held. Choose a method to try again.' })
      }
      return
    }
    api
      .post(`/bookings/${id}/payments/${live._id}/cancel`, { by: 'refresh' })
      .then(() => {
        setNotice({ type: 'warn', text: 'Your last payment was cancelled because the page was refreshed or closed during payment. Your dates are still held. Choose a method to try again.' })
        reload()
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const live = gw?.attempt && ACTIVE.includes(gw.attempt.status)
  // Warn before leaving mid-payment, and cancel the attempt server-side if the page does go away.
  useEffect(() => {
    if (!live) return
    const attemptId = gw.attempt._id
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    const gone = () => beacon(`/bookings/${id}/payments/${attemptId}/cancel`, { by: 'refresh' })
    window.addEventListener('beforeunload', warn)
    window.addEventListener('pagehide', gone)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('pagehide', gone)
    }
  }, [live, gw?.attempt?._id, id])

  // ---------- validation + payload ----------
  function validate() {
    const e = {}
    if (method === 'card') {
      const n = digits(card.number)
      if (!/^\d{13,19}$/.test(n) || !luhn(n)) e.number = "That card number isn't valid"
      const [mm, yy] = card.expiry.split('/').map(Number)
      const now = new Date()
      if (!(mm >= 1 && mm <= 12) || !yy) e.expiry = 'Use MM/YY'
      else if (2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1)) e.expiry = 'This card has expired'
      if (!/^\d{3,4}$/.test(card.cvv)) e.cvv = '3 or 4 digits'
      if (card.name.trim().length < 2) e.name = 'Enter the name on the card'
    }
    if (method === 'upi' && !/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/.test(vpa.trim())) e.vpa = 'Enter a valid UPI ID like name@bank'
    if (method === 'netbanking' && !bank) e.bank = 'Choose your bank'
    if (method === 'wallet' && !wallet) e.wallet = 'Choose a wallet'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const payload = () =>
    method === 'card'
      ? { method, card: { number: digits(card.number), expiry: card.expiry, cvv: card.cvv, name: card.name.trim() } }
      : method === 'upi'
        ? { method, upi: { vpa: vpa.trim() } }
        : method === 'netbanking'
          ? { method, bank }
          : { method, wallet }

  const describe = () => (method === 'card' ? `${brandOf(digits(card.number)) || 'Card'} •••• ${digits(card.number).slice(-4)}` : method === 'upi' ? `UPI ${vpa.trim()}` : method === 'netbanking' ? bank : wallet)

  // ---------- talking to the gateway ----------
  async function start(body = payload(), label = describe()) {
    lastPayload.current = { body, label }
    setNotice(null)
    setGw({ phase: 'processing', label, attempt: null })
    const minDelay = sleep(2200) // a real gateway takes a moment; show the steps
    try {
      const [attempt] = await Promise.all([api.post(`/bookings/${id}/payments`, body), minDelay])
      settle(attempt)
    } catch (err) {
      await minDelay
      setGw(null)
      setNotice({ type: 'error', text: err.message })
      if (err instanceof ApiError && (err.status === 410 || err.status === 409)) reload()
    }
  }

  const settle = (attempt) => {
    setGw({ phase: 'attempt', label: attempt.label, attempt })
    if (attempt.status === 'succeeded') setTimeout(onPaid, 1900)
  }

  async function act(action, extra = {}, { quiet = false } = {}) {
    const keep = gw
    setGw((g) => ({ ...g, phase: 'processing', label: gw.attempt.label, error: '' }))
    const minDelay = sleep(1500)
    try {
      const [attempt] = await Promise.all([api.post(`/bookings/${id}/payments/${keep.attempt._id}/action`, { action, ...extra }), minDelay])
      settle(attempt)
    } catch (err) {
      await minDelay
      // e.g. wrong OTP: stay on the same screen with the message
      setGw({ ...keep, phase: 'attempt', error: quiet ? '' : err.message })
      if (err.status === 409) api.post(`/bookings/${id}/payments/${keep.attempt._id}/cancel`, { by: 'user' }).then(settle).catch(() => {})
    }
  }

  async function cancelPayment(by = 'user') {
    const a = gw?.attempt
    setGw(null)
    if (a && ACTIVE.includes(a.status)) await api.post(`/bookings/${id}/payments/${a._id}/cancel`, { by }).catch(() => {})
    setNotice({ type: 'warn', text: 'Payment cancelled. Your dates are still held. Choose a method to try again.' })
    reload()
  }

  // the request nobody answered in time: ask the server, which marks it expired, and show that result
  async function expire() {
    const a = gw?.attempt
    if (!a) return
    try {
      settle(await api.post(`/bookings/${id}/payments/${a._id}/cancel`, { by: 'user' }))
    } catch {
      setGw(null)
    }
  }

  const closeFailed = () => {
    setGw(null)
    reload()
  }

  // ---------- form ----------
  const field = (name, props) => (
    <label className={`pf ${errors[name] ? 'bad' : ''}`}>
      <span>{props.label}</span>
      <input {...props.input} />
      {errors[name] && <small className="pf-err">{errors[name]}</small>}
    </label>
  )

  const brand = brandOf(digits(card.number))

  return (
    <div className="dp">
      <div className="dp-head">
        <h3>Payment method</h3>
        <span className="test-ribbon">
          <Lock size={12} /> Test mode · no real money
        </span>
      </div>

      {notice && <p className={`notice ${notice.type === 'error' ? 'error' : ''}`}>{notice.text}</p>}

      <div className="dp-grid">
        <div className="dp-methods" role="radiogroup" aria-label="Payment method">
          {METHODS.map(({ id: mid, label, hint, icon: Icon }) => (
            <button key={mid} role="radio" aria-checked={method === mid} className={`dp-method ${method === mid ? 'on' : ''}`} onClick={() => { setMethod(mid); setErrors({}) }}>
              <Icon size={20} />
              <span>
                <strong>{label}</strong>
                <small>{hint}</small>
              </span>
            </button>
          ))}
        </div>

        <div className="dp-form">
          {method === 'upi' && (
            <>
              {field('vpa', { label: 'UPI ID', input: { value: vpa, onChange: (e) => setVpa(e.target.value), placeholder: 'yourname@okhdfcbank', autoComplete: 'off', inputMode: 'email' } })}
              <div className="handles">
                {HANDLES.map((h) => (
                  <button type="button" key={h} className="chip-btn small" onClick={() => setVpa((v) => v.split('@')[0] + h)} disabled={!vpa.split('@')[0]}>
                    {h}
                  </button>
                ))}
              </div>
              <p className="hint">You'll get a request in your UPI app to approve.</p>
            </>
          )}

          {method === 'card' && (
            <>
              <label className={`pf ${errors.number ? 'bad' : ''}`}>
                <span>Card number</span>
                <span className="pf-wrap">
                  <input value={card.number} onChange={(e) => setCard({ ...card, number: formatCard(e.target.value) })} placeholder="1234 5678 9012 3456" inputMode="numeric" autoComplete="off" />
                  {brand && <em className={`card-brand card-brand-${brand.toLowerCase()}`}>{brand}</em>}
                </span>
                {errors.number && <small className="pf-err">{errors.number}</small>}
              </label>
              <div className="pf-row">
                {field('expiry', { label: 'Expiry', input: { value: card.expiry, onChange: (e) => setCard({ ...card, expiry: formatExpiry(e.target.value) }), placeholder: 'MM/YY', inputMode: 'numeric', autoComplete: 'off' } })}
                {field('cvv', { label: 'CVV', input: { value: card.cvv, onChange: (e) => setCard({ ...card, cvv: digits(e.target.value).slice(0, 4) }), placeholder: '•••', inputMode: 'numeric', type: 'password', autoComplete: 'off' } })}
              </div>
              {field('name', { label: 'Name on card', input: { value: card.name, onChange: (e) => setCard({ ...card, name: e.target.value }), placeholder: 'As printed on the card', autoComplete: 'off' } })}
            </>
          )}

          {method === 'netbanking' && (
            <div role="radiogroup" aria-label="Bank" className={`opt-grid ${errors.bank ? 'bad' : ''}`}>
              {BANKS.map((b) => (
                <button key={b} role="radio" aria-checked={bank === b} className={`opt ${bank === b ? 'on' : ''}`} onClick={() => setBank(b)}>
                  <Landmark size={18} /> {b}
                </button>
              ))}
              {errors.bank && <small className="pf-err">{errors.bank}</small>}
            </div>
          )}

          {method === 'wallet' && (
            <div role="radiogroup" aria-label="Wallet" className={`opt-grid ${errors.wallet ? 'bad' : ''}`}>
              {WALLETS.map((w) => (
                <button key={w} role="radio" aria-checked={wallet === w} className={`opt ${wallet === w ? 'on' : ''}`} onClick={() => setWallet(w)}>
                  <Wallet size={18} /> {w}
                </button>
              ))}
              {errors.wallet && <small className="pf-err">{errors.wallet}</small>}
            </div>
          )}

          <button className="btn btn-primary btn-block btn-lg" onClick={() => validate() && start()}>
            <ShieldCheck size={20} /> Pay {inrFromPaise(total)}
          </button>

          <button className="test-toggle" onClick={() => setShowTest((s) => !s)} aria-expanded={showTest}>
            Test data for this demo <ChevronDown size={14} className={showTest ? 'flip' : ''} />
          </button>
          {showTest && (
            <div className="test-data">
              {method === 'card' && (
                <>
                  <div className="handles">
                    {TEST_CARDS.map((t) => (
                      <button key={t.number} className="chip-btn small" onClick={() => { setCard({ number: t.number, expiry: '12/30', cvv: '123', name: card.name || 'Test User' }); setErrors({}) }}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <p>Any future expiry and CVV. Cards that ask for an OTP accept <code>123456</code>. Any other valid card number also asks for an OTP.</p>
                </>
              )}
              {method === 'upi' && <p><code>anything@okhdfcbank</code> approves · an ID containing <code>fail</code> is declined · containing <code>timeout</code> never answers.</p>}
              {method === 'netbanking' && <p>You'll land on a simulated bank page and can authorise or cancel. Punjab National Bank is "down".</p>}
              {method === 'wallet' && <p>You approve on a simulated app. MobiKwik has no balance.</p>}
            </div>
          )}
        </div>
      </div>

      {gw && <Gateway gw={gw} total={total} method={method} act={act} cancel={cancelPayment} expire={expire} close={closeFailed} retry={() => start(lastPayload.current.body, lastPayload.current.label)} />}
    </div>
  )
}

// ---------------- gateway window ----------------

const STEPS = ['Securing your connection', 'Contacting your bank', 'Authorising the payment']

function Gateway({ gw, total, method, act, cancel, expire, close, retry }) {
  const ref = useRef(null)
  const a = gw.attempt

  useEffect(() => {
    const dlg = ref.current
    if (dlg && !dlg.open) dlg.showModal()
  }, [])

  const status = gw.phase === 'processing' ? 'processing' : a?.status
  const terminal = ['succeeded', 'failed', 'cancelled', 'abandoned', 'expired'].includes(status)

  return (
    <dialog ref={ref} className="gw" onCancel={(e) => { e.preventDefault(); if (!terminal && status !== 'processing') cancel() }}>
      <header className="gw-head">
        <div>
          <strong>LookOut</strong>
          <small>Demo Pay · Secure checkout</small>
        </div>
        <div className="gw-amount">
          {inrFromPaise(total)}
          <small>{gw.label}</small>
        </div>
      </header>
      <div className="gw-banner">TEST MODE · simulated payment, nothing is charged</div>

      <div className="gw-body">
        {status === 'processing' && <Processing label={gw.label} />}
        {status === 'awaiting_otp' && <Otp a={a} act={act} error={gw.error} cancel={cancel} expire={expire} />}
        {status === 'awaiting_approval' && <Approve a={a} method={method} act={act} cancel={cancel} expire={expire} total={total} />}
        {status === 'awaiting_bank' && <Bank a={a} act={act} cancel={cancel} />}
        {status === 'succeeded' && (
          <div className="gw-result ok">
            <CheckCircle2 size={56} />
            <h3>Payment successful</h3>
            <p className="muted">{inrFromPaise(total)} paid with {a.label}</p>
            <p className="hint">Confirming your booking…</p>
          </div>
        )}
        {['failed', 'expired', 'cancelled', 'abandoned'].includes(status) && (
          <div className="gw-result bad">
            <XCircle size={56} />
            <h3>{status === 'expired' ? 'Payment timed out' : 'Payment unsuccessful'}</h3>
            <p>{a.failureReason || 'The payment could not be completed.'}</p>
            <p className="hint">You haven't been charged. Your dates are still held for a little while.</p>
            <div className="gw-actions">
              <button className="btn btn-primary" onClick={retry}>Try again</button>
              <button className="btn btn-ghost" onClick={close}>Change payment method</button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  )
}

function Processing({ label }) {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 650)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="gw-processing" role="status">
      <Loader2 className="spin" size={40} />
      <h3>Processing your payment</h3>
      <ul>
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'now' : ''}>
            {i < step ? <CheckCircle2 size={16} /> : i === step ? <Loader2 className="spin" size={16} /> : <span className="dot" />} {i === 1 ? `Contacting ${label}` : s}
          </li>
        ))}
      </ul>
      <p className="hint">Please don't refresh or close this window.</p>
    </div>
  )
}

function Otp({ a, act, error, cancel, expire }) {
  const [otp, setOtp] = useState('')
  const [cool, setCool] = useState(30)
  const [resent, setResent] = useState(false)
  const left = useCountdown(a.expiresAt)
  useEffect(() => {
    if (cool <= 0) return
    const t = setTimeout(() => setCool((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cool])
  const fired = useRef(false)
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      expire() // OTP window ran out
    }
  }, [left, expire])

  return (
    <form
      className="gw-otp"
      onSubmit={(e) => {
        e.preventDefault()
        if (otp.length === 6) act('otp', { otp })
      }}
    >
      <div className="bank-mark"><Landmark size={20} /> Card authentication</div>
      <h3>Enter the OTP</h3>
      <p className="muted">We sent a 6-digit code to your registered mobile number ending ••4821 to authorise <strong>{a.label}</strong>.</p>
      <input className="otp-input" value={otp} onChange={(e) => setOtp(digits(e.target.value).slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" aria-label="One-time password" autoFocus />
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="hint">Demo OTP: <strong>123456</strong> · expires in {left === null ? '…' : mmss(left)}</p>
      <button className="btn btn-primary btn-block" disabled={otp.length !== 6}>Verify and pay</button>
      <div className="gw-links">
        <button type="button" className="link-btn" disabled={cool > 0} onClick={() => { act('resend_otp', {}, { quiet: true }); setCool(30); setResent(true) }}>
          {cool > 0 ? `Resend OTP in ${cool}s` : 'Resend OTP'}
        </button>
        <button type="button" className="link-btn" onClick={() => cancel('user')}>Cancel payment</button>
      </div>
      {resent && <p className="hint">A new OTP was sent (still 123456 in this demo).</p>}
    </form>
  )
}

function Approve({ a, method, act, cancel, expire, total }) {
  const left = useCountdown(a.expiresAt)
  const fired = useRef(false)
  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      expire() // nobody approved in time: the server marks it expired
    }
  }, [left, expire])
  const isUpi = method === 'upi' || a.method === 'upi'
  return (
    <div className="gw-approve">
      <div className="phone" aria-hidden="true">
        <div className="phone-screen">
          <Smartphone size={28} />
          <strong>{isUpi ? 'Collect request' : a.label}</strong>
          <span>{inrFromPaise(total)}</span>
          <small>LookOut</small>
        </div>
      </div>
      <h3>{isUpi ? 'Approve the request in your UPI app' : `Approve in your ${a.label} app`}</h3>
      <p className="muted">{isUpi ? <>We sent a payment request to <strong>{a.label.replace('UPI ', '')}</strong>.</> : <>We sent a payment request to your {a.label} wallet.</>} It expires in <strong>{left === null ? '…' : mmss(left)}</strong>.</p>
      <div className="sim-box">
        <small>Simulate what you'd do on your phone</small>
        <div className="gw-actions">
          <button className="btn btn-primary" onClick={() => act('approve')}>Approve payment</button>
          <button className="btn btn-ghost" onClick={() => act('decline')}>Decline</button>
        </div>
      </div>
      <button className="link-btn" onClick={() => cancel('user')}>Cancel payment</button>
    </div>
  )
}

function Bank({ a, act, cancel }) {
  return (
    <div className="gw-bank">
      <div className="bank-mark"><Landmark size={20} /> {a.label} · NetBanking</div>
      <p className="hint">This is a simulated bank page. Don't enter real credentials.</p>
      <label className="pf"><span>Customer ID</span><input value="DEMO48213" readOnly /></label>
      <label className="pf"><span>Password</span><input type="password" value="demo-password" readOnly /></label>
      <div className="gw-actions">
        <button className="btn btn-primary" onClick={() => act('bank_success')}>Log in and authorise</button>
        <button className="btn btn-ghost" onClick={() => act('bank_failure')}>Cancel at bank</button>
      </div>
      <button className="link-btn" onClick={() => cancel('user')}>Back to LookOut</button>
    </div>
  )
}
