import { enableButton, disableButton } from './helpers.js';

// used to confirm that input.value equals a city from the array
let selectedCity = '';
// used to make sure there is a city selected from the array, not just typed into the input
let isCitySelected = false;

// a function to classify an item as "active"
function addActive(autocompleteItemsElements, currentFocus) {
  if (!autocompleteItemsElements) return;

  // start by removing the "active" class on all items:
  removeActive(autocompleteItemsElements);

  if (currentFocus >= autocompleteItemsElements.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = autocompleteItemsElements.length - 1;

  // add class "autocomplete-active":
  autocompleteItemsElements[currentFocus].classList.add('autocomplete-active');
}

// a function to remove the "active" class from all autocomplete items
function removeActive(autocompleteItemsElements) {
  for (let i = 0; i < autocompleteItemsElements.length; i++) {
    autocompleteItemsElements[i].classList.remove('autocomplete-active');
  }
}

// a function to rmeove autocomplete list from UI
function closeAutocompleteList() {
  const autocompleteItemsElements = document.getElementsByClassName('autocomplete-items');

  for (let i = 0; i < autocompleteItemsElements.length; i++) {
    autocompleteItemsElements[i].remove();
  }
}

function autocomplete(inp, arr) {
  // the autocomplete function takes two arguments, the text field element and an array of possible autocompleted values

  let currentFocus;
  // execute a function when someone writes in the text field:
  inp.addEventListener('input', function (e) {
    if (inp.value !== selectedCity) {
      const searchButton = document.querySelector('.city-search__button');
      disableButton(searchButton);
      isCitySelected = false;
    }

    closeAutocompleteList();

    if (!this.value) return;

    currentFocus = -1;

    // create a DIV element that will contain the items (values):
    const autocompleteList = document.createElement('DIV');
    autocompleteList.setAttribute('id', this.id + 'AutocompleteList');
    autocompleteList.setAttribute('class', 'autocomplete-items');

    // append the DIV element as a child of the autocomplete container:
    this.parentNode.appendChild(autocompleteList);

    // for each item in the array...
    for (let i = 0; i < arr.length; i++) {
      // check if the item starts with the same letters as the text field value:
      if (this.value.length > 2 && arr[i].substr(0, this.value.length).toUpperCase() === this.value.toUpperCase()) {
        // create a DIV element for each matching element:
        const autocompleteItem = document.createElement('DIV');

        // make the matching letters bold:
        autocompleteItem.innerHTML = '<strong>' + arr[i].substr(0, this.value.length) + '</strong>';
        autocompleteItem.innerHTML += arr[i].substr(this.value.length);

        // insert a input field that will hold the current array item's value:
        autocompleteItem.innerHTML += `<input id='autocompleteHidden${i}' type='hidden' value='${arr[i]}'>`;

        // execute a function when someone clicks on the item value (DIV element):
        autocompleteItem.addEventListener('click', function (e) {
          // insert the value for the autocomplete text field:
          inp.value = selectedCity = this.getElementsByTagName('input')[0].value;

          // enable submit button
          const searchButton = document.querySelector('.city-search__button');
          enableButton(searchButton);

          closeAutocompleteList();
        });
        autocompleteList.appendChild(autocompleteItem);
      }
    }
  });
  // execute a function presses a key on the keyboard:
  inp.addEventListener('keydown', function (e) {
    let autocompleteItemsElements = document.getElementById(this.id + 'AutocompleteList');

    if (autocompleteItemsElements) autocompleteItemsElements = autocompleteItemsElements.getElementsByTagName('div');

    if (e.keyCode === 40 && currentFocus < autocompleteItemsElements.length - 1) {
      // if the arrow DOWN key is pressed, increase the currentFocus variable
      currentFocus++;

      // and and make the current item more visible:
      addActive(autocompleteItemsElements, currentFocus);
    } else if (e.keyCode === 38 && currentFocus > 0) {
      // if the arrow UP key is pressed, decrease the currentFocus variable
      currentFocus--;

      // and and make the current item more visible
      addActive(autocompleteItemsElements, currentFocus);
    } else if (e.keyCode === 13) {
      // if the ENTER key is pressed, prevent the form from being submitted if no city is selected,
      if (inp.value !== selectedCity || !isCitySelected) e.preventDefault();

      if (currentFocus > -1 && autocompleteItemsElements) {
        // and simulate a click on the "active" item
        autocompleteItemsElements[currentFocus].click();
        isCitySelected = true;
      }
    }
  });

  // close autocomplete list when someone clicks in the document
  document.addEventListener('click', function (e) {
    closeAutocompleteList();
  });
}

export default autocomplete;
