let taxButton = document.getElementsByClassName("tax-toggle");
console.log(taxButton);
taxButton[0].addEventListener("click", () => {
  let taxInfo = document.getElementsByClassName("tax-info");
  console.log(taxInfo);
  for (let info of taxInfo) {
    if (info.style.display != "inline") {
      info.style.display = "inline";
    } else {
      info.style.display = "none";
    }
  }
});
const filters = document.querySelector("#filters");
const leftIndicator = document.querySelector(".left-indicator");
const rightIndicator = document.querySelector(".right-indicator");

// Function to check overflow and toggle indicators
function checkOverflow() {
  // Check if the content is overflowing horizontally
  if (filters.scrollWidth > filters.clientWidth) {
    rightIndicator.style.display = "flex"; // Show right indicator if content overflows
  } else {
    rightIndicator.style.display = "none";
  }

  // Check if the content has been scrolled past the beginning
  if (filters.scrollLeft > 0) {
    leftIndicator.style.display = "flex"; // Show left indicator if scrolled past start
  } else {
    leftIndicator.style.display = "none";
  }
}

// Attach event listeners
filters.addEventListener("scroll", checkOverflow);
window.addEventListener("resize", checkOverflow);

// Initial check
checkOverflow();

// Event listeners for scrolling on indicator click
leftIndicator.addEventListener("click", () => {
  filters.scrollBy({ left: -100, behavior: "smooth" });
});

rightIndicator.addEventListener("click", () => {
  filters.scrollBy({ left: 100, behavior: "smooth" });
});
