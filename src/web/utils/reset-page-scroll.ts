export function resetPageScroll(): void {
  const scrolling_element = document.scrollingElement
  if (scrolling_element !== null) {
    scrolling_element.scrollTop = 0
  }
}
