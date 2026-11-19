import { useEffect, useRef, useState } from 'react'

/**
 * Fait apparaître son contenu (fondu + légère montée) quand il entre à l'écran.
 * Sans IntersectionObserver, le contenu est simplement affiché.
 */
export default function Reveal({ as: Tag = 'div', className = '', index = 0, children, ...rest }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (visible || !ref.current) return undefined

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '0px 0px -10% 0px' })

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [visible])

  return (
    <Tag
      className={`${visible ? 'anim-fade-up' : 'opacity-0'} ${className}`}
      ref={ref}
      style={{ '--i': index }}
      {...rest}
    >
      {children}
    </Tag>
  )
}
