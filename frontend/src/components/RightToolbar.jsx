const ITEMS = [
  { type: 'note', label: 'Tile', hint: 'A card with a title, notes and any number of links to pages, pictures, videos and PDFs' },
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
