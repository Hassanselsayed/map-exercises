// local modules
import autocomplete from './autocomplete.js';
import {
  enableButton,
  disableButton,
  removeElement,
  showElement,
} from './helpers.js';

// 3rd party modules
import './node_modules/leaflet/dist/leaflet.js';

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const closeForm = document.querySelector('.form__close');
const deleteAll = document.querySelector('.workouts__delete-all');
const inputSort = document.querySelector('.sort__input');
const reverseSort = document.querySelector('.sort__reverse');
const viewAll = document.querySelector('.markers__view-all');
const appEl = document.querySelector('.app');
const loaderEl = document.querySelector('.loader-container');
const workoutsToolbox = document.querySelector('.workouts__toolbox');
const smallScreenEl = document.querySelector('.small-screen');

class Workout {
  constructor(coords, distance, duration, date, id) {
    this.coords = coords; // [lat, long]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.date = date;
    this.id = id;
  }

  async init() {
    await this.setDescription();
  }

  async setDescription() {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    try {
      const [lat, lng] = this.coords;
      const resGeo = await fetch(
        `https://geocode.xyz/${lat},${lng}?geoit=json&auth=123490483069106e15888221x102008`
      );
      const data = await resGeo.json();
      if (!resGeo.ok || !data.city)
        throw new Error(
          `Couldn't get location data because of API calls limit`
        );
      this.description = `${this.type[0].toUpperCase()}${this.type.slice(
        1
      )} in ${data.city}, ${data.state ? data.state : data.region} on ${
        months[this.date.getMonth()]
      } ${this.date.getDate()}`;
    } catch (err) {
      this.description = `${this.type[0].toUpperCase()}${this.type.slice(
        1
      )} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
      console.error(err);
    }
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, date, id, cadence) {
    super(coords, distance, duration, date, id);
    this.cadence = cadence;
    this.calcPace();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, date, id, elevationGain) {
    super(coords, distance, duration, date, id);
    this.elevationGain = elevationGain;
    this.calcSpeed();
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
  #editingWorkoutTime;
  #citySuggestions = [];

  constructor() {
    // Attach event handlers
    form.addEventListener('submit', this.#newWorkout.bind(this));
    inputType.addEventListener('change', this.#toggleElevationFeild);
    containerWorkouts.addEventListener('click', this.#moveToPopup.bind(this));
    inputSort.addEventListener('change', this.#sortWorkouts.bind(this));
    reverseSort.addEventListener('click', this.#reverseSorting.bind(this));
    deleteAll.addEventListener('click', this.#reset.bind(this));
    viewAll.addEventListener('click', this.#viewAllMarkers.bind(this));
    closeForm.addEventListener('click', this.#hideForm.bind(this));
  }

  async init() {
    if (screen.width <= 1000) {
      removeElement(loaderEl);
      removeElement(appEl);
      return;
    }

    // remove screen size prompt
    removeElement(smallScreenEl);

    // Get user's position
    await this.#getPosition();
  }

  async #getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        // location granted callback function
        await this.#loadMap.bind(this),
        // location denied callback function
        await this.#citySearchUI.bind(this)
      );
    }
  }

  async #citySearchUI() {
    // create html for city search
    const html = `
      <li class="city-search">
        <h2 class="city-search__title flex__space-between">
          Please choose a city where you want to log your workouts
          <i class="fas fa-info-circle" title="Please note that I'm using 2 different APIs for generating the city suggestions and searching for city coordinates, and they don't necessarily have the exact same cities. For example, you will find 'Toronto, AU' in the list of suggestions, but if you choose it, you won't be able to load it on the map."></i>
        </h2>
        <h4 class="city-search__sub-title">
          Enter 3 characters for suggestions to appear
        </h4>
        <form class="city-search__form flex__space-between" autocomplete="off" action="">
          <div class="autocomplete">
            <input class="city-search__input" id="myInput" name="myCity" placeholder="Search for a city">
          </div>
          <button class="city-search__button" type="submit" disabled>Submit</button>
        </form>
      </li>
    `;

    // insert html inUI + show/hide relevant elements
    form.insertAdjacentHTML('afterend', html);
    showElement(appEl);
    removeElement(loaderEl);

    // method to get all cities
    await this.#getAllCities();

    // function to generate autocomplete suggestions
    autocomplete(document.getElementById('myInput'), this.#citySuggestions);

    // attach event listener to city search form
    document
      .querySelector('.city-search__form')
      .addEventListener('submit', this.#searchForCity.bind(this));
  }

  async #getAllCities() {
    // get all countries
    const allCountries = await fetch(
      'https://countriesnow.space/api/v0.1/countries'
    );
    const countries = (await allCountries.json()).data;

    // create an array of `city, country` strings to be used for autocomplete suggestions
    countries.forEach(co =>
      co.cities.forEach(city =>
        this.#citySuggestions.push(`${city}, ${co.iso2}`)
      )
    );
  }

  async #searchForCity(e) {
    e.preventDefault();
    const searchButton = document.querySelector('.city-search__button');
    disableButton(searchButton);
    searchButton.classList.remove('active');

    const citySearchInput = document.querySelector('.city-search__input');
    const inputSplit = citySearchInput.value.split(', ');
    const cityName = inputSplit[0];
    const countryName = inputSplit[1];

    const url = `https://api.api-ninjas.com/v1/city?country=${countryName}&&name=${cityName}&&limit=1`;
    const options = {
      method: 'GET',
      headers: {
        'X-Api-Key': 'AH29ePu1Mv1yF0PhthKyIw==R4U7iJjAMsZOnkPD',
      },
    };

    const citySearchEl = document.querySelector('.city-search');

    try {
      const response = await fetch(url, options);
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          `Sorry couldn't get city details, API calls limit reached. Please refresh page and allow location access to use the app.`
        );
      if (result.length === 0)
        throw new Error(`Sorry couldn't find city, please choose another one.`);

      await this.#loadMap({
        coords: {
          latitude: result[0].latitude,
          longitude: result[0].longitude,
        },
      });

      // hide city search after map has loaded
      removeElement(citySearchEl);
    } catch (error) {
      // remove existing error message, if any
      citySearchEl.querySelector('.error')?.remove();

      // create error node
      const errorNode = document.createElement('h3');
      errorNode.classList.add('error');
      errorNode.innerHTML = error;

      // append error node
      citySearchEl.appendChild(errorNode);
    }

    citySearchInput.value = '';
  }

  async #loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    // leaflet library
    const coords = [latitude, longitude];
    this.#map = L.map('map', { zoomSnap: 0.1 });

    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // handling clicks on map
    this.#map.on('click', this.#showForm.bind(this));

    // get data from local storage
    await this.#getLocalStorage();

    // Change UI

    showElement(appEl);
    removeElement(loaderEl);
    showElement(workoutsToolbox);

    this.#map.setView(coords, this.#mapZoomLevel);
  }

  #showForm(mapE) {
    if (mapE) {
      this.#mapEvent = mapE;
    }
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  #hideForm() {
    // Empty inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => {
      form.style.display = 'grid';
    }, 1000);
  }

  #toggleElevationFeild() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  async #newWorkout(e) {
    // validate input data
    const validInputs = (...inputs) =>
      inputs.every(input => Number.isFinite(input));
    const allPositive = (...inputs) => inputs.every(input => input > 0);
    e.preventDefault();

    // get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;
    const currentDate = this.#isEditing ? this.#editingWorkoutTime : new Date();
    const id = (Date.now() + '').slice(-10);

    // check if data is valid
    // if workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      ) {
        return alert('Inputs have to be positive numbers!');
      }

      workout = new Running(
        [lat, lng],
        distance,
        duration,
        currentDate,
        id,
        cadence
      );
    }

    // if workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;
      // check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      ) {
        return alert('Inputs have to be positive numbers!');
      }

      workout = new Cycling(
        [lat, lng],
        distance,
        duration,
        currentDate,
        id,
        elevation
      );
    }

    await workout.init();

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
  }

  #renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords).addTo(this.#map);
    this.#addPopup(marker, workout);
  }

  #editWorkoutMarker(workout) {
    this.#map.eachLayer(layer => {
      if (
        layer._latlng &&
        layer._latlng.lat === workout.coords[0] &&
        layer._latlng.lng === workout.coords[1]
      ) {
        layer.closePopup();
        this.#addPopup(layer, workout);
      }
    });
  }

  #addPopup(layer, workout) {
    layer
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  #renderWorkout(workout) {
    // enable toolbox buttons
    enableButton(deleteAll);
    enableButton(viewAll);
    enableButton(inputSort);

    let html = `
      <li class="workout workout--${workout.type}" id="${
      workout.id
    }" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__toolbox">
          <i class="fas fa-edit workout__edit" title="Edit workout" id="edit-${
            workout.id
          }"></i>
          <i class="fas fa-trash workout__delete" title="Delete workout" id="delete-${
            workout.id
          }"></i>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
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
    document
      .getElementById(`edit-${workout.id}`)
      .addEventListener('click', this.#editWorkout.bind(this, workout));
    document
      .getElementById(`delete-${workout.id}`)
      .addEventListener('click', this.#deleteWorkout.bind(this, workout, true));
  }

  #moveToPopup(e) {
    if (
      !e.target.className.includes('edit') &&
      !e.target.className.includes('delete')
    ) {
      const workoutEl = e.target.closest('.workout');

      if (!workoutEl) return;

      const workout = this.#workouts.find(
        workout => workout.id === workoutEl.dataset.id
      );

      this.#map.setView(workout.coords, this.#mapZoomLevel, {
        animate: true,
        pan: {
          duration: 1,
        },
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
        inputCadence
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputCadence.value = workout.cadence;
      }
      if (workout.elevationGain) {
        inputElevation
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation.value = workout.elevationGain;
      }

      // preserve date of original workout
      this.#editingWorkoutTime = new Date(workout.date);

      // delete workout
      this.#deleteWorkout.call(this, workout);

      // initialize #mapEvent so a new pin could be added
      this.#mapEvent = {};
      this.#mapEvent.latlng = {
        lat: workout.coords[0],
        lng: workout.coords[1],
      };
    } else {
      alert('Please submit open form');
    }
  }

  #deleteWorkout(workout, all = false) {
    // remove workout from ui & list
    removeElement(document.getElementById(workout.id));
    this.#workouts = this.#workouts.filter(wo => wo.id !== workout.id);

    // remove existing map pin
    if (all) {
      this.#map.eachLayer(layer => {
        if (
          layer._latlng &&
          layer._latlng.lat === workout.coords[0] &&
          layer._latlng.lng === workout.coords[1]
        ) {
          this.#map.removeLayer(layer);
        }
      });
    }

    // reset local storage
    this.#setLocalStorage();
  }

  #sortWorkouts() {
    if (this.#workouts.length === 0) return;
    this.#workouts
      .sort((a, b) => a[inputSort.value] - b[inputSort.value])
      .forEach(workout => {
        removeElement(document.getElementById(workout.id));
        this.#renderWorkout(workout);
      });

    reverseSort.classList.remove('hidden');
    reverseSort.classList.remove('flip');
  }

  #reverseSorting() {
    if (this.#workouts.length === 0) return;
    if (inputSort.value) {
      this.#workouts.reverse().forEach(workout => {
        removeElement(document.getElementById(workout.id));
        this.#renderWorkout(workout);
      });

      reverseSort.classList.toggle('flip');
      reverseSort.style.transition = 'all 0.5s';
    }
  }

  #setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  async #getLocalStorage() {
    const data = await JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    for (const wo of data) {
      let workout;
      const { coords, distance, duration, date, id } = wo;
      const dateObject = new Date(date);

      if (wo.type === 'running') {
        const { cadence } = wo;
        workout = new Running(
          coords,
          distance,
          duration,
          dateObject,
          id,
          cadence
        );
      } else {
        const { elevationGain } = wo;
        workout = new Cycling(
          coords,
          distance,
          duration,
          dateObject,
          id,
          elevationGain
        );
      }

      await workout.init();
      this.#workouts.push(workout);
      this.#renderWorkout(workout);
      this.#renderWorkoutMarker(workout);
    }
  }

  #viewAllMarkers() {
    if (this.#workouts.length === 0) return;
    const latLngs = this.#workouts.map(wo => wo.coords);
    this.#map.fitBounds(latLngs, { padding: [90, 90] });
  }

  #reset() {
    this.#workouts.forEach(workout => this.#deleteWorkout(workout, true));
    localStorage.removeItem('workouts');

    disableButton(deleteAll);
    disableButton(viewAll);
    disableButton(inputSort);
  }
}

const app = new App();
await app.init();
