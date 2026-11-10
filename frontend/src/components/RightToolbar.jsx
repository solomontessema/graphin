const ITEMS = [
  { type: 'webpage', label: 'Web page', hint: 'Save a web page by its link' },
  { type: 'pdf', label: 'PDF', hint: 'Link to a PDF file' },
  { type: 'image', label: 'Image', hint: 'Link to a picture' },
  { type: 'video', label: 'Video', hint: 'Link to a video (YouTube or Vimeo)' },
  { type: 'note', label: 'Note', hint: 'A card with a title and your own commentary' },
  { type: 'text', label: 'Label', hint: 'Text written straight on the canvas, with no box: headings and captions' },
  { type: 'shape', label: 'Shape', hint: 'Draw a shape behind tiles to organize them' },
];

/** The toolbar on the right edge of the canvas. Each button adds one kind of item to the network. */
export default function RightToolbar({ onAdd }) {
  return (
    <nav className="right-toolbar" aria-label="Add to network">
      <span className="rt-title">Add</span>
      {ITEMS.map((item) => (
        <button key={item.type} className="ghost" onClick={() => onAdd(item.type)} title={item.hint}>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

export { ITEMS };
