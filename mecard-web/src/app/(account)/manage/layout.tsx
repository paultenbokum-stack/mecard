// /manage/ screens, with a slot for the editors that open in a modal over the
// list (@modal: Next intercepting routes, so their URLs still work on their own).
export default function ManageLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
