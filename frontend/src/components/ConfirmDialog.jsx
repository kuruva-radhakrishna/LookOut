import { useEffect, useRef } from 'react'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) {
  const ref = useRef(null)

  useEffect(() => {
    const dlg = ref.current
    if (!dlg) return
    if (open && !dlg.open) dlg.showModal()
    if (!open && dlg.open) dlg.close()
  }, [open])

  return (
    <dialog ref={ref} className="dialog" onCancel={onCancel} onClick={(e) => e.target === ref.current && onCancel()}>
      <h3>{title}</h3>
      <p>{message}</p>
      <div className="dialog-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Keep it
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
