import './LoadingScreen.css';

export function LoadingScreen() {
  return (
    <div className="app-loading-screen" aria-label="Yükleniyor">
      <div className="loading-stars1" />
      <div className="loading-stars2" />
      <div className="loading-stars3" />
      <div className="loading-page">
        <div className="loading-moon" />
        <div className="loading-main-star">
          <div className="loading-star-five loading-rotating" />
        </div>
        <div className="loading-constellations">
          <div className="loading-constellation loading-rotating-slow">
            <div className="loading-baby-star">
              <div className="loading-star-five loading-rotating" />
            </div>
            <div className="loading-baby-star">
              <div className="loading-star-five loading-rotating" />
            </div>
            <div className="loading-baby-star">
              <div className="loading-star-five loading-rotating" />
            </div>
            <div className="loading-baby-star">
              <div className="loading-star-five loading-rotating" />
            </div>
          </div>
          <div className="loading-angled">
            <div className="loading-constellation loading-rotating-slow">
              <div className="loading-baby-star">
                <div className="loading-star-five loading-rotating" />
              </div>
              <div className="loading-baby-star">
                <div className="loading-star-five loading-rotating" />
              </div>
              <div className="loading-baby-star">
                <div className="loading-star-five loading-rotating" />
              </div>
              <div className="loading-baby-star">
                <div className="loading-star-five loading-rotating" />
              </div>
            </div>
          </div>
        </div>
        <div className="loading-text">Yükleniyor...</div>
      </div>
    </div>
  );
}
