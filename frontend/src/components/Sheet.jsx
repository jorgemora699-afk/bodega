import { Drawer } from "vaul";
import { X } from "lucide-react";
import "./Sheet.css";

export default function Sheet({ open, onOpenChange, title, children, cerrarAlTocarFuera = false }) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} dismissible={cerrarAlTocarFuera}>
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className="sheet-content">
          <div className="sheet-handle" />
          <div className="sheet-header">
            <Drawer.Title className="sheet-title">{title}</Drawer.Title>
            <button className="sheet-cerrar" onClick={() => onOpenChange(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="sheet-body">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}