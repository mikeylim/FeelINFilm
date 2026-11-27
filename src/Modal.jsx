import { useLanguage } from './Language'
import React, { useId, useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Modal({ title, children, onClose }) {
  const { t } = useLanguage()
  const dialog = useRef(null)
  const titleId = useId()
  useLayoutEffect(() => {
    const node = dialog.current
    node.showModal()
    return () => { if (node.open) node.close() }
  }, [])

  return <dialog className="dialog" ref={dialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="dialog-inner">
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="icon-button" aria-label={t('Close dialog')} onClick={onClose}><X size={21} /></button>
      </div>
      {children}
    </div>
  </dialog>
}
