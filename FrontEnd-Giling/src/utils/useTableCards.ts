import { useCallback, useRef } from 'react'

/**
 * Phone-friendly tables: give the <table> the class "table-cards" and this ref.
 * Below 768px (see index.css) each row becomes a card and every cell shows its column
 * header as a label, so lists no longer need horizontal scrolling. Desktop is unchanged.
 *
 * The hook copies each <th> text into data-label on the matching <td>, and keeps doing so
 * when rows re-render (pagination, filters).
 */
export function useTableCards<T extends HTMLTableElement = HTMLTableElement>() {
    const observer = useRef<MutationObserver | null>(null)

    return useCallback((table: T | null) => {
        observer.current?.disconnect()
        observer.current = null
        if (!table) return

        const apply = () => {
            const headers: string[] = []
            table.querySelectorAll('thead tr:last-child th').forEach(th => {
                const span = Number((th as HTMLTableCellElement).colSpan) || 1
                const text = (th.textContent || '').trim()
                for (let i = 0; i < span; i++) headers.push(text)
            })
            table.querySelectorAll('tbody tr').forEach(tr => {
                let col = 0
                Array.from(tr.children).forEach(cell => {
                    const td = cell as HTMLTableCellElement
                    const label = td.colSpan > 1 && td.colSpan >= headers.length ? '' : (headers[col] || '')
                    if (td.getAttribute('data-label') !== label) td.setAttribute('data-label', label)
                    col += td.colSpan || 1
                })
            })
        }

        apply()
        observer.current = new MutationObserver(apply)
        observer.current.observe(table, { childList: true, subtree: true })
    }, [])
}
