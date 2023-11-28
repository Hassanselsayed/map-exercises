import "./node_modules/leaflet/dist/leaflet.js";
// import "./node_modules/leaflet-draw/dist/leaflet.draw.js";
// import './node_modules/leaflet-draw/dist/leaflet.draw-src.js';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAll = document.querySelector('.workouts__delete-all');
const inputSort = document.querySelector('.sort__input');
const reverseSort = document.querySelector('.sort__reverse');

class Workout {
  #date = new Date();
  id = (Date.now() + '').slice(-10);

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, long]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }
  
  setDescription() {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.#date.getMonth()]} ${this.#date.getDate()}`
  }
}

class Running extends Workout {
  type = 'running';


  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this.setDescription();
  }
  
  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this.setDescription();
  }
  
  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APP Architecture 
class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #isEditing = false;

  constructor() {
    // Get user's position
    this.#getPosition();

    // Attach event handlers
    form.addEventListener('submit', this.#newWorkout.bind(this));
    inputType.addEventListener('change', this.#toggleElevationFeild);
    containerWorkouts.addEventListener('click', this.#moveToPopup.bind(this));
    inputSort.addEventListener('change', this.#sortWorkouts.bind(this));
    reverseSort.addEventListener('click', this.#reverseSorting.bind(this));
    deleteAll.addEventListener('click', this.#reset.bind(this));
  }

  #getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // success callback function
        this.#loadMap.bind(this),
        // error callback function
        // TODO: add the following logic into a separate function
        function() {
          // TODO: add a search (text) input to enter a city, then load the map using that city
          const html = `
            <li>
              <h2>
                Please choose a city where you want to log your workouts
              </h2>
            </li>
          `
          form.insertAdjacentHTML('afterend', html);
        }
      );
    };
  };

  #loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // Leaflet library
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this.#showForm.bind(this));

    // Get data from local storage
    this.#getLocalStorage();

    this.#workouts.forEach(workout => {
      this.#renderWorkoutMarker(workout);
    })
  };

  #showForm(mapE) {
    if (mapE) {
      this.#mapEvent = mapE;
    }
    form.classList.remove('hidden');
    inputDistance.focus();
  };

  #hideForm() {
    // Empty inputs
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => {
      form.style.display = 'grid';
    }, 1000);
  }

  #toggleElevationFeild() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  };
  
  #newWorkout(e) {
    const validInputs = (...inputs) => inputs.every(input => Number.isFinite(input));
    const allPositive = (...inputs) => inputs.every(input => input > 0);
    e.preventDefault();

    // get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // check if data is valid
    // if workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // check if data is valid
      if (!validInputs(distance, duration, cadence) || !allPositive(distance, duration, cadence)) {
        return alert('Inputs have to be positive numbers!')
      }

      workout = new Running([lat, lng], distance, duration, cadence);
    }
    
    // if workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // check if data is valid
      if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration)) {
        return alert('Inputs have to be positive numbers!')
      }

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }    
    
    // add new object to workout array
    this.#workouts.push(workout);

    // render workout on map as a marker
    if (!this.#isEditing) this.#renderWorkoutMarker(workout);
    else this.#editWorkoutMarker(workout);

    // render workout on list
    this.#renderWorkout(workout);

    // hide form and clear input fields
    this.#hideForm();

    // set local storage to all workouts
    this.#setLocalStorage();

    this.#isEditing = false;
  };
  
  #renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords).addTo(this.#map)
    this.#addPopup(marker, workout);
  }

  #editWorkoutMarker(workout) {
    this.#map.eachLayer(layer => {
      if (layer._latlng && layer._latlng.lat === workout.coords[0] && layer._latlng.lng === workout.coords[1]) {
        layer.closePopup();
        this.#addPopup(layer, workout);
      }
    })
  }

  #addPopup(layer, workout) {
    layer
      .bindPopup(L.popup({
        maxWidth: 250,
        minWidth: 100,
        autoClose: false,
        closeOnClick: false,
        className: `${workout.type}-popup`
      }))
      .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`)
      .openPopup();
  }

  #renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" id="${workout.id}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__toolbox">
          <i class="fas fa-edit workout__edit" title="Edit workout" id="edit-${workout.id}"></i>
          <i class="fas fa-trash workout__delete" title="Delete workout" id="delete-${workout.id}"></i>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      `;
    }
    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      `;
    }

    html += `</li>`;

    form.insertAdjacentHTML('afterend', html);
    document.getElementById(`edit-${workout.id}`).addEventListener('click', this.#editWorkout.bind(this, workout));
    document.getElementById(`delete-${workout.id}`).addEventListener('click', this.#deleteWorkout.bind(this, workout, true));
  }

  #moveToPopup(e) {
    if (!e.target.className.includes('edit') && !e.target.className.includes('delete')) {
      const workoutEl = e.target.closest('.workout');
  
      if (!workoutEl) return;
  
      const workout = this.#workouts.find(workout => workout.id === workoutEl.dataset.id);
  
      this.#map.setView(workout.coords, this.#mapZoomLevel, {
        animate: true,
        pan: {
          duration: 1
        }
      });
    }
  }

  #editWorkout(workout) {
    if (form.classList.value.includes('hidden')) {
      this.#isEditing = true;
      // show form
      this.#showForm();
      
      // add workout properties as form defaults
      inputType.value = workout.type;
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;
      
      // toggle between cadence and elevGain
      if (workout.cadence) {
        inputElevation.closest('.form__row').classList.add('form__row--hidden');
        inputCadence.closest('.form__row').classList.remove('form__row--hidden');
        inputCadence.value = workout.cadence;
      }
      if (workout.elevationGain) {
        inputElevation.closest('.form__row').classList.remove('form__row--hidden');
        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation.value = workout.elevationGain;
      }
      
      // delete workout
      this.#deleteWorkout.call(this, workout);

      // initialize #mapEvent so a new pin could be added
      this.#mapEvent = {};
      this.#mapEvent.latlng = { lat: workout.coords[0], lng: workout.coords[1] };
    } else {
      alert('Please submit open form');
    }
  }

  #deleteWorkout(workout, all = false) {
    // remove workout from ui & list
    this.#removeWorkoutFromUI(workout);
    this.#workouts = this.#workouts.filter(wo => wo.id !== workout.id);

    // remove existing map pin
    if (all) {
      this.#map.eachLayer(layer => {
        if (layer._latlng && layer._latlng.lat === workout.coords[0] && layer._latlng.lng === workout.coords[1]) {
          this.#map.removeLayer(layer);
        }
      });
    }

    // reset local storage
    this.#setLocalStorage();
  }

  #removeWorkoutFromUI(workout) {
    document.getElementById(workout.id).remove();
  }

  #sortWorkouts() {
    this.#workouts
      .sort((a, b) => a[inputSort.value] - b[inputSort.value])
      .forEach(workout => {
        this.#removeWorkoutFromUI(workout);
        this.#renderWorkout(workout);
      });
    
    reverseSort.classList.remove('hidden');
    reverseSort.classList.remove('flip');
  }

  #reverseSorting(e) {
    if (inputSort.value) {
      this.#workouts
        .reverse()
        .forEach(workout => {
          this.#removeWorkoutFromUI(workout);
          this.#renderWorkout(workout);
        });
      
      console.log(e);
      reverseSort.classList.toggle('flip');
      reverseSort.style.transition = 'all 0.5s';
    }
  }

  #setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  #getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(workout => {
      this.#renderWorkout(workout);
    })
  }


  #reset() {
    this.#workouts.forEach(workout => this.#deleteWorkout(workout, true));
    localStorage.removeItem('workouts');
  }
}

const app = new App();


// TODO: Extra features to consider
// 4. sort workouts by a certain fields (distance or duration)
// 5. rebuild running and cycling objects coming from local storage
// 6. better error and confirmation messages
// 7. ability to position map to position all workouts (important)
// 8. ability to draw lines and shapes, instead of points
// 9. geocode location from coordinates ("run in faro, portugal")
// 10. display weather data for workout time and place
// 11. add city search input in case location not granted
// 12. better explanation of how to use the app (in readme and on ui/modal)
// 13. fix styling
// 14. ability to delete forms