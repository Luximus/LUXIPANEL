import { useState, type RefObject } from "react";
import { Eye, EyeOff } from "lucide-react";
import styles from "./PassphraseInput.module.css";

/**
 * Input de contraseña/passphrase con botón ojo para mostrar/ocultar. Reutiliza
 * el patrón de `ConnectLocalKeyModal` para todos los campos de passphrase
 * (bóveda SSH, editor de panel, importar). Gestiona su propio estado de
 * visibilidad; el caller controla el valor.
 */
export function PassphraseInput({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  ariaShow,
  ariaHide,
  className = "lp-modal-input",
  inputRef,
  ariaInvalid,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  ariaShow: string;
  ariaHide: string;
  className?: string;
  /** Ref opcional al input para enfocarlo (validación de obligatorios). */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Marca el input como inválido (resalte en rojo + a11y). */
  ariaInvalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={styles.wrapper}>
      <input
        id={id}
        ref={inputRef}
        className={`${styles.input} ${className}`}
        aria-invalid={ariaInvalid || undefined}
        type={show ? "text" : "password"}
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className={`lp-input-reveal ${styles.revealBtn}`}
        onClick={() => setShow((v) => !v)}
        disabled={disabled}
        aria-label={show ? ariaHide : ariaShow}
        style={{ cursor: disabled ? "not-allowed" : "pointer" }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
