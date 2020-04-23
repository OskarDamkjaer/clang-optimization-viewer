int demo(int c, char nonascii) {
  while (
       (c >= 'a' && c <= 'z')
    || (c >= '0' && c <= '9')
    ||  c == '_' // if this line is removed the condition block is not split, making the loop bottom tested
    || (c >= 128)) {
    c += 1;
  }
  return c;
}
