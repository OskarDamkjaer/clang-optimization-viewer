int bar(int x)
{
  return x * 2;
}

void foo(int *a, int *b, int n)
{
  for (unsigned i = 0; i < n; i++)
    a[i] = bar(b[i]);
}