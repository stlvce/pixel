const SideBar = ({
  color,
  changeColor,
}: {
  color: string;
  changeColor: (color: string) => void;
}) => {
  return (
    <div className="fixed z-10 left-5 bottom-5">
      <div className="bg-base-200 rounded-box p-1 shadow-xl/10">
        <input
          className="w-10 h-10"
          type="color"
          value={color}
          onChange={(e) => {
            changeColor(e.target.value);
          }}
        />
      </div>
    </div>
  );
};

export default SideBar;
