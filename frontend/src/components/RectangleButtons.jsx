import './RectangleButtons.css';
// ThreeUI Dark Glass source: only label, native button props and sizing are adapted.
export function RectangleButtons({children, mode="dark", hue=0, saturation=1, brightness=1, className="", ...props}) {
 return <button {...props} data-mode={mode} className={`section-button ${className}`} style={{...props.style,filter:`hue-rotate(${hue}deg) saturate(${saturation}) brightness(${brightness})`}}><span className="section-button__title">{children}</span><span className="section-button__circle" aria-hidden="true" /></button>;
}
