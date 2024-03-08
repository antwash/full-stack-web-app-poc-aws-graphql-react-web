import { useGetCarsQuery } from "./graphql/generated";
export function App() {
  const { data, loading } = useGetCarsQuery();

  if (loading) {
    return <h1>Loading....</h1>;
  }

  if (!data || data.cars.length === 0) {
    return <h1>No car!</h1>;
  }

  return (
    <table style={{ width: "20%" }}>
      <tbody>
        <tr>
          <th>Model</th>
          <th>Make</th>
          <th>Year</th>
        </tr>
        {data.cars.map((car) => {
          return (
            <tr key={car.id}>
              <td>{car.model}</td>
              <td>{car.make}</td>
              <td>{car.year}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default App;
