import { Button } from "@notra/ui/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@notra/ui/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@notra/ui/components/ui/sheet";
import { useState } from "react";
import { createRoot } from "react-dom/client";

function DialogConfirmFixture() {
  const [submissions, setSubmissions] = useState(0);
  const [childSubmissions, setChildSubmissions] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nested, setNested] = useState(false);
  const sheet = new URLSearchParams(location.search).has("sheet");
  const Root = sheet ? Sheet : Dialog;
  const Content = sheet ? SheetContent : DialogContent;
  const Title = sheet ? SheetTitle : DialogTitle;

  return (
    <Root defaultOpen>
      <Content>
        <Title>Confirm shortcut regression</Title>
        <form
          id="confirm-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmissions((count) => count + 1);
          }}
        >
          <input aria-label="Required field" required />
          <textarea aria-label="Draft" />
        </form>
        <label>
          <input
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
            type="checkbox"
          />
          Disable save
        </label>
        <label>
          <input
            checked={busy}
            onChange={(event) => setBusy(event.target.checked)}
            type="checkbox"
          />
          Save busy
        </label>
        <Button
          data-dialog-confirm
          disabled={disabled}
          form="confirm-form"
          loading={busy}
          type="submit"
        >
          Save
        </Button>
        <Button onClick={() => setNested(true)} type="button">
          Open child
        </Button>
        <output data-testid="submissions">{submissions}</output>
        <output data-testid="child-submissions">{childSubmissions}</output>
        <Dialog onOpenChange={setNested} open={nested}>
          <DialogContent>
            <DialogTitle>Child dialog</DialogTitle>
            <textarea aria-label="Child draft" />
            <Button
              data-dialog-confirm
              onClick={() => setChildSubmissions((count) => count + 1)}
              type="button"
            >
              Save child
            </Button>
          </DialogContent>
        </Dialog>
      </Content>
    </Root>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<DialogConfirmFixture />);
}
